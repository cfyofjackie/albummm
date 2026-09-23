// The canvas: one place that knows how big the board is, and the only place a
// coordinate ever changes units.
//
// Layout coordinates have always had two axes with different bases. `x` and
// `width` are percent of the board's WIDTH, because that is what CSS `left` /
// `width` resolve against; `y` and `height` are percent of the board's HEIGHT,
// because that is what CSS `top` / `height` resolve against. The two are only
// interchangeable through the board's own shape, and that shape used to be a
// constant baked into this codebase (`BOARD_HEIGHT = 125`, and a `FRAME_ASPECT`
// of 0.8 sprinkled through the solver, the checker and the renderer).
//
// A second board ratio — the 4:3 landscape sheet the 满幅拼贴 template prints on —
// makes that constant wrong rather than merely untidy: on a 4:3 board the two axes
// differ by 4/3, not 4/5, so every inlined 0.8 would silently squash the vertical
// axis by 40%. So the board is resolved from the skeleton instead, and the
// conversion lives here and nowhere else.
//
// Why `height` is 75 for a 4:3 sheet and not 133: it is measured in the SAME unit
// as the width — percent of board width — so `width / height` is the board's real
// aspect ratio with no third convention to remember. Keeping one unit across both
// axes is what makes the photo-ratio invariant checkable at all.
//
// This is additively compatible: a skeleton that declares no board (every template
// written before this file) resolves to the original 4:5 sheet, whose conversion
// factor is 100 / 125 = 0.8 — the same number the inlined constants used — so
// existing layouts stay bit-for-bit identical.

export const BOARD_PRESETS = {
  // The editorial portrait sheet every earlier template prints on.
  '4:5': { width: 100, height: 125 },
  // The full-bleed landscape sheet: photos on paper with no typography at all.
  '4:3': { width: 100, height: 75 },
}

// Used whenever a skeleton does not say. Deliberately the original board, so this
// module changes no existing output.
export const DEFAULT_BOARD_RATIO = [4, 5]

export const boardRatioKey = (ratio) => `${ratio[0]}:${ratio[1]}`

export const isSupportedBoardRatio = (ratio) => (
  Array.isArray(ratio) && ratio.length === 2 && Boolean(BOARD_PRESETS[boardRatioKey(ratio)])
)

export function supportedBoardRatios() {
  return Object.keys(BOARD_PRESETS)
}

// Fraction of board WIDTH that one full unit of board height spans. For 4:5 this is
// 1.25 — 100% of board height is 125 width units — and for 4:3 it is 0.75.
//
// The conversion between the axes is ONE number used in two directions, and getting
// the direction wrong is the single easiest mistake to make here:
//
//     width units  ×  yFactor  =  percent of board height     (what CSS `top` wants)
//     percent of board height  ÷  yFactor  =  width units
//
// On the 4:5 sheet that factor is 1.25, so a physical height of 15 prints at 18.75% of
// the board's height and not at 12%. This file used to hold only the second form,
// spelled `toBoardHeight = physical / FRAME_ASPECT` with FRAME_ASPECT = 0.8, and the
// two spellings are exactly reciprocal — which is why the same bug can be written
// either way round and still look plausible. There is one spelling now.
const axisFactor = (preset) => preset.height / preset.width

/**
 * Resolve the canvas a skeleton prints on, plus the two conversions between its
 * axes. This is the only place those conversions exist.
 *
 * @param skeleton  a template skeleton; its `board.ratio` picks the preset.
 * @returns { ratio, key, width, height, referenceHeight, yFactor, xFactor,
 *            toBoardHeightPercent, toWidthUnits }
 *
 * `height` and `referenceHeight` are both in width units (percent of board width), so
 * `width / height` is the board's true ratio. `toBoardHeightPercent` converts a
 * vertical measurement in width units into the space CSS `top` and `height` use, and
 * `toWidthUnits` is its exact inverse. `xFactor` is 1 for every preset here, and
 * exists so the renderer never has to know that.
 */
export function boardFor(skeleton) {
  const requested = skeleton?.board?.ratio
  const key = Array.isArray(requested) && BOARD_PRESETS[boardRatioKey(requested)]
    ? boardRatioKey(requested)
    : boardRatioKey(DEFAULT_BOARD_RATIO)
  const preset = BOARD_PRESETS[key]
  const factor = axisFactor(preset)
  return {
    ratio: key.split(':').map(Number),
    key,
    width: preset.width,
    height: preset.height,
    // 100% of board height, expressed in width units. 125 on the 4:5 sheet.
    referenceHeight: factor,
    // Width units in, board-height percent out — and back again.
    yFactor: factor,
    xFactor: 1,
    toBoardHeightPercent: (widthUnits) => widthUnits * factor,
    toWidthUnits: (boardHeightPercent) => boardHeightPercent / factor,
  }
}

// The 4:5 sheet, for the few places that genuinely have no skeleton to hand.
export const DEFAULT_BOARD = boardFor(null)

export const toBoardHeightPercent = (widthUnits, board = DEFAULT_BOARD) => board.toBoardHeightPercent(widthUnits)
export const toWidthUnits = (boardHeightPercent, board = DEFAULT_BOARD) => board.toWidthUnits(boardHeightPercent)

// A board as a rectangle in width units, anchored at the origin. Used by the
// uniform fit, which centres a solved block inside the sheet.
export function boardRectFor(board) {
  return { left: 0, top: 0, right: board.width, bottom: board.height, width: board.width, height: board.height }
}

// The same rectangle as percentages of the board box: what a CSS `width` /
// `height` needs to reproduce the sheet on screen.
export function boardAspectStyle(skeleton) {
  const board = boardFor(skeleton)
  return { aspectRatio: `${board.ratio[0]} / ${board.ratio[1]}` }
}

// A cluster's zone, as a rectangle plus its span in width units.
//
// Vertical values are in the SAME unit as horizontal ones — percent of board width —
// which is what every skeleton written before this file assumes. That is a deliberate
// convention rather than an oversight: the zone describes physical room on the sheet,
// and physical room is measured in width units everywhere else in the solver too. A
// skeleton that prefers to write its bands the way CSS does (percent of board height)
// opts in with `cluster.verticalAxis: 'height'`.
export function zoneOf(skeleton) {
  const board = boardFor(skeleton)
  const { zone, verticalAxis } = skeleton.cluster
  const base = verticalAxis === 'height' ? board.referenceHeight : 1
  const top = zone.top * base
  const bottom = zone.bottom * base
  return {
    left: zone.left,
    right: zone.right,
    top,
    bottom,
    width: zone.right - zone.left,
    height: bottom - top,
  }
}
