// Capability: collage pile.
//
// A fourth family, and the only one that treats the sheet as *paper* rather than
// as a grid to be filled:
//
//   span-grid        N equal-width columns; every tile the same width.
//   justified-rows   rows whose height is solved so widths fill the row.
//   collage-pile     uniform instant prints dropped into overlapping, tilted rows
//                    that cover the whole sheet, bleeding off its edges.
//
// What is deliberately NOT here: any coordinate, and any canvas size. The family is
// told how big the sheet is and works in width units from then on; the uniform fit
// onto the sheet happens in `materialize`, exactly like every other family. That is
// why the same capability can print a 4:5 sheet or a 4:3 one with no new branch.
//
// The stacking IS the composition. Three quantities describe it, and all three are
// the template's to declare rather than this file's to assume:
//
//   · how many rows the pile has            (`perRow`)     — the horizontal rhythm;
//   · how much neighbours overlap sideways  (`overlap`)    — the horizontal stack;
//   · how far one row sinks into the next   (the swept    — the vertical stack, and
//                                            row pitch)     the one that sets the
//                                                           block's proportion.
//
// That last one is the whole reason this works. Tall cards laid out on a
// full-height row pitch make a TALL block, which on a landscape sheet scales down
// to a small ornament in the middle; sinking each row into the one above shortens
// the block, which is what lets it reach the sheet's edges. So the row pitch is
// swept rather than fixed, and the sweep is what finds the pile that fits the
// canvas the template asked for.
//
// Every photo keeps its own proportion inside its card. The card's own height is
// the photo's height plus a white rim; a proportion too tall to make a print is
// capped at `frameTallest` — the CARD gets shorter, the PHOTO is never squashed,
// and it is reported as a crop like every other deliberate fold.

import { clamp, seededRandom, shuffle } from '../geometry.js'
import { paintedCoverage } from '../contract.js'

// Instant-print proportions: a white rim on the sides and top, a deeper lip at the
// bottom. Fractions of the card's width, measured off the reference sheet.
const BORDER = 0.05
const LIP = 0.125
// The tallest card this family will make, as height / width. The cap only bites for
// photos outside the accepted proportion band, and a photo it bites is reported as a
// crop rather than stretched to fit.
const CARD_TALLEST = 1.34

// How much neighbours cover each other inside a row, as a share of a card's width.
// Fixed rather than searched: once the card WIDTH is the searched quantity (see
// `pile()`), a second free horizontal lever would just give the solver two ways to
// say the same thing, and the template's `overlap` — which describes exactly this
// look — is what the value is set from.
const CARD_OVERLAP = 0.2

// How far the pile is asked to overshoot the sheet, as a share of the board on each
// axis. This single number is what keeps the prints large, and it is the one setting
// worth reading the reasoning for.
//
// Fitting the pile strictly inside the sheet looks safe and is the worst option. A
// uniform fit fills whichever axis binds first, so a pile that is taller than it is
// wide — which is what four rows of instant prints are — ends up fitted by HEIGHT,
// leaving bare paper down both sides and shrinking every print to pay for margins
// nobody asked for. Letting the pile overshoot instead makes the height bind, the
// width fill the sheet, and the sheet crop the pile top and bottom. That is what a
// full-bleed collage is: the composition continues past the paper.
//
// It is bounded by the template's own `cluster.bleed`, because the fit may push a
// print exactly as far past the edge as the contract will accept and not a percent
// more — otherwise a layout that looks perfect reports as out of bounds.
const EDGE_ALLOWANCE = 0.04

// A photo's proportion, folded into what a card can hold. A very flat photo becomes
// a card as tall as its own proportion allows, which is narrower than a landscape
// print — the shape follows the photo, never the other way round.
const PHOTO_RATIO_MIN = 0.5
const PHOTO_RATIO_MAX = 2.2

// Sweeps. These are search grids, not template intent: which one is right depends
// on how many photos there are and what shape the sheet is, and the template's own
// `cluster` narrows them.
//
// The row count is the coarse lever on the sheet's proportion and the row pitch the
// fine one, so both are swept. Getting this wrong is not subtle: with too few rows
// the pile is a wide flat band that scales down to a stripe on the sheet, and with
// too many it is a column. The sweep is what lets one capability print a landscape
// sheet and a portrait one from the same numbers.
const ROW_RANGE = [3, 6]
// How much of the sheet each row spans. This is the coarse lever on the pile's
// proportion: a row that fills the sheet exactly is a wide row, and five wide rows
// make a pile far taller than a landscape page can hold — so it has to be searched,
// not assumed. See `pile()` for why a row no longer spans the sheet by construction.
const FILL_MIN = 0.55
const FILL_MAX = 1
const FILL_STEP = 0.05
// How much one row sinks into the row below it. The fine lever on the same thing.
const SPACING_MIN = 0.06
const SPACING_MAX = 0.5
const SPACING_STEP = 0.04
const JITTER_STEPS = [0, 1]
// How a row's card width scales with how many cards share it. Linear would give rows
// of 3 and 2 equal cards at wildly different sizes; a mild compression keeps the
// prints comparable while still letting the fuller row reach wider, which is what
// makes the pile's silhouette step in and out the way a hand-laid one does.
const ROW_WEIGHT = 0.9

const ROUND = 1e6
const round = (value) => Math.round(value * ROUND) / ROUND

// Split `count` cards into `rows` near-even rows, remainder first. Rows of 3 and 4
// rather than 4 and 2: an even split is what keeps the pile reading as a sheet
// instead of a wide band with a small row stranded under it.
function splitRows(count, rows) {
  const out = []
  let cursor = 0
  for (let r = 0; r < rows; r += 1) {
    const take = Math.ceil((count - cursor) / (rows - r))
    out.push(take)
    cursor += take
  }
  return out.filter((size) => size > 0)
}

// Invert a photo's proportion into a card's inner box, in card-width units.
//
// The one thing this function must never do is touch the photo. A tall photo makes
// a tall card; when that would make a card too tall to be a print, the CARD is cut
// down at `tallest` and the photo inside it is cropped. Squashing the photo instead
// would keep every card the same size and give every photo the wrong shape.
export function cardShapeFor(ratio, tallest = CARD_TALLEST, border = BORDER, lip = LIP) {
  const safe = clamp(ratio, PHOTO_RATIO_MIN, PHOTO_RATIO_MAX)
  const innerWidth = 1 - border * 2
  const innerHeight = innerWidth / safe
  if (border + innerHeight + lip <= tallest) {
    return { innerWidth, innerHeight, cropped: false }
  }
  const capped = tallest - border - lip
  return { innerWidth: capped * safe, innerHeight: capped, cropped: true }
}

// The card's outer height: one rim, the photo, then the caption lip.
export const cardHeightOf = (innerHeight, border = BORDER, lip = LIP) => border + innerHeight + lip

// The axis-aligned box a tilted card actually paints. Every overlap, bounds and
// coverage measurement in this family goes through it, because a card turned 12
// degrees is genuinely wider and taller than its own frame.
export function rotatedExtent(width, height, tilt) {
  const rad = (Math.abs(tilt) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    w: width * cos + height * sin,
    h: width * sin + height * cos,
  }
}

// A card narrower than this share of the sheet is a stamp, not a photo.
export const MIN_CARD_SHARE = 0.2

const gapOn = (a, b, axis) => Math.max(
  a[axis] - (b[axis] + (axis === 'x' ? a.w : a.h)),
  b[axis] - (a[axis] + (axis === 'x' ? a.w : a.h)),
  0,
)

// Cards that end up touching nothing. A pile is one object; a card floating in the
// middle of the sheet with margin all round it is a defect the coverage number
// cannot see, because the cards beside it already carry the average.
function isolatedCount(frames) {
  const boxes = frames.map((frame) => {
    const extent = rotatedExtent(frame.width, frame.height, frame.tilt)
    return { x: frame.centreX - extent.w / 2, y: frame.centreY - extent.h / 2, w: extent.w, h: extent.h }
  })
  let isolated = 0
  boxes.forEach((box, index) => {
    const touches = boxes.some((other, otherIndex) => (
      otherIndex !== index && gapOn(box, other, 'x') <= 1e-6 && gapOn(box, other, 'y') <= 1e-6
    ))
    if (!touches) isolated += 1
  })
  return isolated
}

// How much of the sheet the pile covers: the UNION of the painted cards, as a share
// of the board.
//
// The union, not the sum. Adding the cards up counts the stacked part two or three
// times over and reports 160% of a sheet as inked — and for a family whose whole
// point is that the prints overlap, a metric that rewards overlap is worse than none.
//
// Everything here is in width units on both axes, which is the only space where a
// width and a height make an area. A card's height arrives as a percent of board
// HEIGHT and is converted on the way in; skipping that step inflates the figure by
// the ratio between the axes, which on a 4:5 sheet looks like a plausible number.
const COVERAGE_STEP = 0.5

function unionShare(rects, board) {
  if (!rects.length) return 0
  const nx = Math.ceil(board.width / COVERAGE_STEP)
  const ny = Math.ceil(board.height / COVERAGE_STEP)
  const cells = new Uint8Array(nx * ny)
  for (const rect of rects) {
    const x0 = Math.max(0, rect.centreX - rect.width / 2)
    const y0 = Math.max(0, rect.centreY - rect.height / 2)
    const x1 = Math.min(board.width, rect.centreX + rect.width / 2)
    const y1 = Math.min(board.height, rect.centreY + rect.height / 2)
    if (!(x1 > x0) || !(y1 > y0)) continue
    const cx0 = Math.max(0, Math.floor(x0 / COVERAGE_STEP))
    const cy0 = Math.max(0, Math.floor(y0 / COVERAGE_STEP))
    const cx1 = Math.min(nx - 1, Math.ceil(x1 / COVERAGE_STEP) - 1)
    const cy1 = Math.min(ny - 1, Math.ceil(y1 / COVERAGE_STEP) - 1)
    for (let iy = cy0; iy <= cy1; iy += 1) {
      for (let ix = cx0; ix <= cx1; ix += 1) cells[iy * nx + ix] = 1
    }
  }
  let covered = 0
  for (let i = 0; i < cells.length; i += 1) covered += cells[i]
  return (covered * COVERAGE_STEP * COVERAGE_STEP) / (board.width * board.height)
}

// Two different boxes, and conflating them is a real bug rather than a detail.
//
//   · `painted` — where the pile shows on the sheet. Clipped to the sheet, because
//     board percent is all that is addressable: a card hanging half off the right
//     edge contributes exactly the half that is painted. Coverage and "does the pile
//     fill the sheet" are measured from this, and it is the number the template
//     promises.
//
//   · `extent` — the pile's own outer box, after the fit. This is what the renderer
//     is centred on.
//
// HOW THE FIT WORKS, because getting this wrong is what made an earlier version
// report 80% coverage while painting 19% of the sheet: the pile is solved in its own
// space, then ONE uniform scale maps it onto the board, and both boxes are measured
// from the RESULT. Measuring the block before the fit scores something the renderer
// never draws.
//
// The fit targets the board *plus* the template's edge allowance, not the board
// itself. Fitting the pile exactly inside the sheet leaves a strip of bare paper on
// whichever axis the pile's proportion does not match, and no amount of searching
// fixes that — the pile would have to grow past the edge to hide its own margin,
// which is precisely what a full-bleed sheet does. So the target is deliberately
// larger than the sheet: the pile overshoots, and the sheet crops it.
//
// The allowance is a BUDGET, not a target to spend. Sizing the pile to fill the padded
// target lets a small pile scale up until its outer cards sit a quarter of the sheet
// past the edge — the padded target does not know how tall a tilted corner is, so a
// pile that is shorter than the target grows until something else stops it. What
// actually stops it is the invariant the contract checks, so the scale is solved
// directly from it: the largest uniform scale at which no card crosses the edge by
// more than the allowance. Within that, the pile fills the sheet.
// The pile's outer box in the space the contract measures in: width units on both
// axes. `centreY` and the card heights arrive as board-HEIGHT percent, so they convert
// through the board's own ratio — the one conversion, in the one place the fitted tiles
// are read back.
function tilesExtent(tiles, board) {
  const boxes = tiles.map((tile) => {
    const tilt = (Math.abs(tile.tilt || 0) * Math.PI) / 180
    const width = tile.card.width * Math.cos(tilt) + tile.card.height * Math.sin(tilt)
    const height = (tile.card.width * Math.sin(tilt) + tile.card.height * Math.cos(tilt)) * board.yFactor
    const x = tile.centreX
    const y = tile.centreY
    return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 }
  })
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.min(...boxes.map((box) => box.top)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  }
}

function fitted(frames, board, edgeAllowance = 0) {  // Measured from the ROTATED boxes. A flat box is smaller than what the browser
  // paints, so limits derived from it are not limits at all: the corner a tilted card
  // adds pushes the pile past every edge it was supposedly held inside, and the
  // measurements the optimiser sees are then of a pile the renderer never draws.
  const boxes = frames.map((frame) => {
    const extent = rotatedExtent(frame.width, frame.height, frame.tilt)
    return {
      left: frame.centreX - extent.w / 2,
      top: frame.centreY - extent.h / 2,
      right: frame.centreX + extent.w / 2,
      bottom: frame.centreY + extent.h / 2,
    }
  })
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.right))
  const bottom = Math.max(...boxes.map((box) => box.bottom))
  if (!(right > left) || !(bottom > top)) return null

  const slackX = board.width * edgeAllowance
  const slackY = board.height * edgeAllowance
  const centreX = (left + right) / 2
  const centreY = (top + bottom) / 2
  const halfWidth = (right - left) / 2
  const halfHeight = (bottom - top) / 2

  // The scale is the largest one at which the pile both fills the sheet and stays
  // within its bleed allowance, and it is found by SEARCH rather than by formula. A
  // closed form is what kept going wrong here: the pile's extent, the rotated corner a
  // tilt adds, and the board's own proportion each suggest a different answer, and
  // every version that solved for one of them landed outside the budget the contract
  // checks. So the fit measures what it is about to hand the renderer, and takes the
  // largest of a short bisection that satisfies the rule. It is a dozen cheap
  // measurements on a candidate that is scored once.
  const within = (measured) => {
    const box = tilesExtent(measured.tiles, board)
    return box.left >= -slackX - 1e-6
      && box.right <= board.width + slackX + 1e-6
      && box.top >= -slackY - 1e-6
      && box.bottom <= board.height + slackY + 1e-6
  }

  const build = (scale, shiftX = 0, shiftY = 0) => {
    const offsetX = board.width / 2 - centreX * scale + shiftX
    const offsetY = board.height / 2 - centreY * scale + shiftY
    const tiles = frames.map((frame) => ({
      pile: true,
      tilt: frame.tilt,
      centreX: offsetX + frame.centreX * scale,
      centreY: (offsetY + frame.centreY * scale) * board.yFactor,
      card: { width: frame.width * scale, height: frame.height * scale * board.yFactor },
    }))
    return { scale, offsetX, offsetY, tiles }
  }

  const fillScale = Math.min(
    (board.width / 2 + slackX) / halfWidth,
    (board.height / 2 + slackY) / halfHeight,
  )
  let low = 0
  let high = fillScale
  let current = build(fillScale)
  if (!within(current)) {
    for (let step = 0; step < 24; step += 1) {
      const mid = (low + high) / 2
      const candidate = build(mid)
      if (within(candidate)) {
        low = mid
        current = candidate
      } else {
        high = mid
      }
    }
  }

  // Last word: measure what is about to be handed over, against the rule itself, and
  // scale and slide it in if anything is still out. The search above is the mechanism;
  // this is the guarantee, and it is deliberately stated in the same terms the contract
  // checks rather than in terms of the extent the search reasoned about.
  const verifyFinal = (measured) => {
    const box = tilesExtent(measured.tiles, board)
    const overLeft = Math.max(0, -slackX - box.left)
    const overRight = Math.max(0, box.right - (board.width + slackX))
    const overTop = Math.max(0, -slackY - box.top)
    const overBottom = Math.max(0, box.bottom - (board.height + slackY))
    if (overLeft + overRight + overTop + overBottom <= 1e-6) return measured
    const width = box.right - box.left
    const height = box.bottom - box.top
    const shrink = Math.min(
      (board.width + slackX * 2) / width,
      (board.height + slackY * 2) / height,
    )
    return build(
      measured.scale * shrink,
      (overLeft - overRight) / 2,
      (overTop - overBottom) / 2 / board.yFactor,
    )
  }
  current = verifyFinal(current)

  const { scale, offsetX, offsetY, tiles } = current
  if (typeof globalThis !== 'undefined') {
    globalThis.__FIT_TRACE = (globalThis.__FIT_TRACE || [])
    globalThis.__FIT_TRACE.push({
      scale: +scale.toFixed(4),
      fillScale: +fillScale.toFixed(4),
      withinFill: within(build(fillScale)),
      withinFinal: within(current),
      fw: +frames[0].width.toFixed(3),
      fh: +frames[0].height.toFixed(3),
      cardW: +tiles[0].card.width.toFixed(3),
      n: frames.length,
    })
    if (globalThis.__FIT_TRACE.length > 40) globalThis.__FIT_TRACE.shift()
  }

  let paintedLeft = board.width
  let paintedTop = board.height
  let paintedRight = 0
  let paintedBottom = 0
  for (const tile of tiles) {
    paintedLeft = Math.min(paintedLeft, Math.max(0, tile.centreX - tile.card.width / 2))
    paintedTop = Math.min(paintedTop, Math.max(0, tile.centreY - tile.card.height / 2))
    paintedRight = Math.max(paintedRight, Math.min(board.width, tile.centreX + tile.card.width / 2))
    paintedBottom = Math.max(paintedBottom, Math.min(board.height, tile.centreY + tile.card.height / 2))
  }

  return {
    scale,
    offsetX,
    offsetY,
    tiles,
    painted: { left: paintedLeft, top: paintedTop, right: paintedRight, bottom: paintedBottom },
    extent: {
      left: offsetX + left * scale,
      top: offsetY + top * scale,
      right: offsetX + right * scale,
      bottom: offsetY + bottom * scale,
    },
  }
}

/**
 * Every pile this family can make for the photo set.
 *
 * The solver asks each capability in the pipeline for these and keeps the
 * best-scoring one, so a template steers the sheet through its `cluster` numbers
 * without this file knowing anything about the template.
 */
export function blocks(entries, skeleton, { seed, board }) {
  if (!entries.length || !board) return []
  const cluster = skeleton?.cluster
  if (!cluster) return []
  const [minRows, maxRows] = cluster.perRow ?? ROW_RANGE
  const tallest = cluster.frameTallest ?? CARD_TALLEST
  const tiltMax = cluster.tilt ?? 12
  const [overlapMin, overlapMax] = cluster.overlap ?? [0.16, 0.34]
  const jitterMax = cluster.jitter ?? 0.03
  const jitterSteps = cluster.jitterSteps ?? JITTER_STEPS
  // The template's `overlap` is what the horizontal stack should look like. It is a
  // preference rather than a rule here, because how much the cards must stack for the
  // pile to come out the shape of the sheet depends on the photos, which the template
  // cannot know. The search finds the fill; this decides which equally-fitting pile
  // looks most like the reference.
  const preferred = clamp((overlapMin + overlapMax) / 2, 0.04, 0.55)
  // How far the pile is asked to overshoot the sheet. The template's `bleed` and this
  // family's own default are the same number on purpose — see EDGE_ALLOWANCE.
  const edgeAllowance = (cluster.bleed ?? EDGE_ALLOWANCE * 100) / 100

  const found = []
  for (const order of ['mixed', 'shuffled']) {
    const ordered = order === 'mixed'
      // Alternating flat and upright keeps the card heights within a row close, so
      // the pile does not end up with one row of tall prints beside one of bands.
      ? [...entries].sort((a, b) => (a.index % 2) - (b.index % 2) || a.placed - b.placed)
      : shuffle(entries, seededRandom(`${seed}:pile:${order}`))

    for (let rows = minRows; rows <= Math.min(maxRows, ordered.length); rows += 1) {
      const sizes = splitRows(ordered.length, rows)
      if (!sizes.length) continue
      const widestRow = Math.max(...sizes)
      // A pile whose widest row holds one card is a column, not a collage.
      if (widestRow < 2) continue
      // A sheet carrying more cards than this per row is a contact sheet, not a
      // pile: the cards stop being prints and start being stamps.
      if (widestRow > (cluster.maxPerRow ?? 5)) continue

      for (let fill = FILL_MIN; fill <= FILL_MAX + 1e-9; fill += FILL_STEP) {
        for (let spacing = SPACING_MIN; spacing <= SPACING_MAX + 1e-9; spacing += SPACING_STEP / 2) {
          for (const jitterStep of jitterSteps) {
            const jitter = jitterMax * jitterStep
            const built = pile(ordered, {
              sizes, spacing, fill, jitter, tiltMax, tallest, seed, board,
            })
            if (!built) continue
            const { frames } = built
            // Score the pile AS IT WILL BE DRAWN, fit and all. Anything measured
            // before the fit is a number the renderer never produces.
            const fit = fitted(frames, board, edgeAllowance)
            if (!fit) continue
            if (!(fit.painted.right > fit.painted.left) || !(fit.painted.bottom > fit.painted.top)) continue
            const candidate = {
              frames,
              fit,
              cols: widestRow,
              rows: sizes.length,
              rowSizes: sizes,
              spacing,
              fill,
              jitter,
              // What the horizontal stack actually came out at, measured from the
              // widest row rather than assumed. Scored against what the template says
              // the stack should look like — a preference, not a rule, because the
              // template's range is a look and the sheet fit is a requirement.
              overlap: actualOverlap(frames, widestRow),
              // Density of the painted cards over the sheet, measured AFTER the fit and
              // by the contract's own union rule: the reference's ink coverage.
              coverage: Math.min(1, paintedCoverage(fit.tiles, board)),
              isolated: isolatedCount(frames),
              tilt: frames.reduce((total, frame) => total + Math.abs(frame.tilt), 0) / frames.length,
              order,
              family: 'collage-pile',
              gutter: 0,
              colW: Math.max(...frames.map((frame) => frame.width)),
              offset: 0,
            }
            // Signals to the solver that this block needs a centre-anchored fit.
            candidate.materialize = (zones, boardArg) => materialize(candidate, boardArg ?? board)
            found.push(candidate)
          }
        }
      }
    }
  }
  return found
}

// The overlap a pile actually ended up with, measured off its widest row: how much
// of a card its neighbour covers, as a share of the card's width. Read back rather
// than assumed, so the preference below is scored against the real geometry.
function actualOverlap(frames, size) {
  if (size < 2) return 0
  const row = frames.slice(0, size)
  const width = row[0].width
  const span = row[size - 1].centreX - row[0].centreX
  return clamp(1 - span / ((size - 1) * width), -0.5, 0.8)
}

// Lay one pile out in the family's own space: x and y both in card-width units,
// origin at the sheet's top-left. Everything here is deterministic given the seed,
// because a seed may rearrange the pile but must never invent a new style.
//
// The one arithmetic decision that matters is how wide a card comes out, and it took
// three wrong answers to get here. Sizing a row so that it spans the sheet exactly is
// the tempting one, and it cannot work: five rows that each span the sheet are five
// rows made of TALL cards, and the pile then comes out far taller than a landscape
// page — so the uniform fit shrinks the whole thing and the sheet ends up half empty.
// The card width is therefore driven by a searched fill instead, and the overlap
// follows from it.
function pile(entries, settings) {
  const {
    sizes, spacing, fill, jitter, tiltMax, tallest, seed, board,
  } = settings

  const random = seededRandom(`${seed}:pile:${sizes.length}:${spacing}:${fill}:${jitter}`)
  // The card's SHAPE depends only on the photo's proportion, so it is measured once
  // in card-width units and then multiplied by the actual card width.
  const shapes = entries.map((entry) => cardShapeFor(entry.placed, tallest))
  const widestRow = Math.max(...sizes)
  const baseWidth = (board.width * fill) / widestRow

  // Row heights come from the tallest card sharing the row, and every card in the
  // row sits on that baseline — so a shorter card in the same row does not float.
  const rowCardWidths = []
  const rowHeights = []
  let cursor = 0
  for (let r = 0; r < sizes.length; r += 1) {
    const size = sizes[r]
    const width = baseWidth * (size / widestRow) ** ROW_WEIGHT * (1 + (random() - 0.5) * 2 * jitter)
    let inner = 0
    for (let k = 0; k < size; k += 1) {
      inner = Math.max(inner, shapes[cursor + k].innerHeight)
    }
    rowCardWidths.push(width)
    rowHeights.push(width * cardHeightOf(inner))
    cursor += size
  }

  // Rows sink into the one above by `spacing`. That single number is the fine lever
  // on the sheet's proportion: it shortens the pile without touching the cards, and
  // the sweep above is what finds the value that makes the pile the shape of the
  // sheet it is printed on.
  const rowPitch = rowHeights.map((height) => height * (1 - spacing))

  const frames = []
  let top = 0
  let index = 0
  for (let r = 0; r < sizes.length; r += 1) {
    const size = sizes[r]
    const rowHeight = rowHeights[r]
    const width = rowCardWidths[r]
    const rowWidth = width * size
    // Each row is centred on the sheet, so the horizontal bleed is shared by both
    // edges instead of piling up on the right.
    let x = (board.width - rowWidth) / 2
    for (let k = 0; k < size; k += 1) {
      const cardHeight = width * cardHeightOf(shapes[index].innerHeight)
      const tilt = (random() - 0.5) * 2 * tiltMax
      const centreY = top + rowHeight - cardHeight / 2
      frames.push({
        entry: entries[index],
        index,
        width,
        height: cardHeight,
        tilt,
        ratio: clamp(entries[index].placed, PHOTO_RATIO_MIN, PHOTO_RATIO_MAX),
        centreX: x + width / 2 + (random() - 0.5) * 2 * jitter * width,
        centreY: centreY + (random() - 0.5) * 2 * jitter * rowHeight,
        // A seed may shuffle the stacking order, but only by a nudge: turning the
        // whole order loose is what collapses a pile into cards buried at random.
        zIndex: index + 1 + Math.round((random() - 0.5) * 2),
      })
      // Cards in a row abut at their full width and overlap by `CARD_OVERLAP`; a
      // deliberate small overlap rather than a solved span, so the row's width comes
      // out of the card size instead of the other way round.
      x += width * (1 - CARD_OVERLAP)
      index += 1
    }
    top += rowPitch[r]
  }

  if (!frames.length) return null
  return { frames }
}

// Score against the same shared invariants as every other family, plus this one's
// own terms. Lower is better.
export function score(block, target) {
  const { frames, fit } = block
  const board = target.board
  if (!frames?.length || !fit || !board) return { total: Infinity }

  const contentWidth = fit.painted.right - fit.painted.left
  const contentHeight = fit.painted.bottom - fit.painted.top
  if (!(contentWidth > 0) || !(contentHeight > 0)) return { total: Infinity }

  const areas = frames.map((frame) => frame.width * frame.height)
  const cardArea = areas.reduce((total, area) => total + area, 0)
  const heroShare = Math.max(...areas) / cardArea
  const coverage = block.coverage

  // How much of the sheet the pile reaches. A painted box spanning only 90% of the
  // width still has a strip of bare paper down each side, and no amount of coverage
  // hides bare paper along an edge — the eye reads the silhouette first.
  //
  // `painted` is measured in width units on both axes, so both shares are taken
  // against the sheet's own width. The height share is NOT taken against
  // `board.height`, which is the same measurement — dividing by it again would report
  // every pile as 75% of the sheet tall on a 4:3 board.
  //
  // Each share is capped at 1 before the shortfall is taken: a full-bleed pile is MEANT
  // to run past the edge, and charging it for the overshoot would price a covered
  // sheet the same as an empty one.
  const widthShare = Math.min(1, contentWidth / board.width)
  const heightShare = Math.min(1, contentHeight / board.width)
  const reach = (1 - widthShare) + (1 - heightShare)

  // How much of the pile has been pushed off the sheet. Some is the point of a
  // full-bleed template; a lot means the outer rows are decoration rather than
  // photographs, and it is also the cheapest way for a candidate to raise its measured
  // coverage — cropping photos it never has to show costs nothing and counts as ink.
  // So the overshoot is priced, and priced on the axis it happens on.
  const spill = Math.max(0, contentWidth / board.width - 1) + Math.max(0, contentHeight / board.width - 1)

  // The pile's own proportion, which is the one quantity that decides whether it can
  // fill the sheet at all: the uniform fit fills whichever axis binds first, so a
  // pile shaped like the sheet fills both. Weighted heavily for that reason — it is
  // not a taste, it is the arithmetic of the fit.
  const blockRatio = (fit.extent.right - fit.extent.left) / (fit.extent.bottom - fit.extent.top)
  const ratioMiss = Math.abs(Math.log(blockRatio / (board.width / board.height)))

  // The photo's own width, not the card's: the white rim is chrome, and the promise
  // the template makes is about how wide the PHOTOS come out. Sizing this off the
  // card would let a sheet pass the width floor with prints a tenth smaller than it
  // looks.
  const photoWidths = frames
    .map((frame) => frame.width * fit.scale * cardShapeFor(frame.ratio).innerWidth)
    .sort((a, b) => a - b)
  const narrowest = photoWidths[0] / board.width
  const median = photoWidths[Math.floor(photoWidths.length / 2)] / board.width

  const minCoverage = target.minCoverage ?? 0.6
  // The ceiling the SCORER prices is deliberately looser than the one the template
  // asks for. A ceiling tight enough to be a real optimum would make every candidate
  // that keeps its prints at the promised width pay for covering "too much", and the
  // solver would answer by shrinking the prints — which is how a fill-the-sheet
  // objective ends up producing a sheet of stamps. The width floor is what actually
  // holds the coverage in place, so the ceiling only has to stop a solid slab.
  const maxCoverage = target.maxCoverage ?? 0.85
  const belowTarget = Math.max(0, minCoverage - coverage)
  const aboveTarget = Math.max(0, coverage - maxCoverage)

  return {
    // Coverage leads, and by a wide margin. It is the one term that measures what the
    // sheet LOOKS like, and every other term can be improved by making the photos
    // smaller or the pile squarer — which is exactly how a "fill the sheet" objective
    // ends up producing a sheet that is not filled.
    total: belowTarget * 4000
      // Over the ceiling costs less than under the floor, but most of the rest:
      // under-covering leaves visible paper, which the template's whole premise is
      // against, while over-covering turns the pile into a slab of overlapping paper.
      + aboveTarget * 5000
      + reach * 200
      // The overshoot is charged from the first percent, not past a threshold: a
      // candidate that raises its measured coverage by pushing cards off the sheet is
      // gaining ink it never has to show, and any free allowance is an invitation to
      // do exactly that.
      + spill * 3000
      // The pile's proportion against the sheet's. A soft term, not a hard one: only a
      // pile shaped like the sheet can fill it on BOTH axes, so this steers the search
      // toward the compositions that can — but it is a taste next to coverage, and it
      // must never win over the width floor below.
      + ratioMiss * 40
      // The width floor is what the template PROMISES about its prints. Second only to
      // coverage: a sheet of stamps that covers everything is not the template either.
      + Math.max(0, (target.minPhotoShare ?? target.minCardShare ?? MIN_CARD_SHARE) - narrowest) * 5000
      + (block.isolated ?? 0) * 90
      + Math.max(0, heroShare - 0.25) * 60
      // Where the template says the stack should look. A preference, not a rule: it
      // breaks ties between two piles that fill the sheet equally well, and loses to
      // any pile that fills it better.
      + Math.abs(block.overlap - (target.preferredOverlap ?? 0.25)) * 120,
    columns: block.cols,
    offset: 0,
    blockRatio,
    shape: ratioMiss,
    coverage,
    fill: cardArea / (board.width * board.height),
    usedArea: coverage,
    band: block.rows,
    heroShare,
    lean: 0,
    baseStep: 0,
    cornerShortfall: 0,
    tileScale: 0,
    tileShape: 0,
    medianHeight: 0,
    deadColumns: 0,
    void: (block.isolated ?? 0) > 0,
    reach,
    ratioMiss,
    narrowest,
    median,
    isolated: block.isolated ?? 0,
  }
}

/**
 * Fitted tiles in board percent.
 *
 * This family differs from the packed ones in two ways the fit step has to know
 * about: the anchor is the card's CENTRE — a rotation happens about the centre, so a
 * centre-anchored card never drifts out of its slot — and the rotation is carried
 * through to the renderer.
 *
 * The fit itself is the shared rule: one uniform scale for both axes, so ratios stay
 * exact; then the pile is centred on the sheet. Unlike the tiled families there is
 * no reserved zone to centre inside — the template reserves the whole sheet and
 * declares how far the pile may run past its edge — so the target is the board
 * itself.
 *
 * Both dimensions reach the renderer in the SAME physical space — fractions of
 * board WIDTH — for the same reason the instant prints do it: the renderer divides
 * them to get the card's unitless shape, and that division is only meaningful if
 * both sides share a unit. The board's vertical conversion is applied exactly once,
 * in the renderer, on the way to CSS.
 */
export function materialize(block, board) {
  const { frames, fit } = block
  const { scale, offsetX, offsetY } = fit

  return frames
    .map((frame) => {
      const shape = cardShapeFor(frame.ratio)
      // Every quantity below is derived from the frame width and this one uniform
      // scale. `fit.tiles` — the shape the coverage metric measures — is built from
      // exactly the same two numbers, which is what makes the number the solver
      // optimises and the number the contract reports the same number. Computing the
      // card again from a different part of the pipeline is how those two drifted to
      // a factor of two apart.
      const cardWidth = frame.width * scale
      const innerWidth = cardWidth * shape.innerWidth
      const innerHeight = cardWidth * shape.innerHeight
      const cardHeight = cardWidth * cardHeightOf(shape.innerHeight)
      return {
        photo: frame.entry.photo,
        id: frame.entry.photo.id,
        role: 'tile',
        // True only when the card had to be capped for this photo's proportion.
        crop: shape.cropped || frame.entry.clamped,
        originalAspect: frame.entry.original,
        // Centre-anchored, in WIDTH UNITS on both axes like every other number the
        // contract reads. The board's vertical conversion is the renderer's, applied
        // exactly once on the way to CSS — reporting it here in board percent as well
        // is how the same measurement ends up counting the ratio twice.
        centreX: round(offsetX + frame.centreX * scale),
        centreY: round(offsetY + frame.centreY * scale),
        // The PHOTO's box, in width units on both axes — the same space the contract
        // measures and the coverage metric counts. The white rim is chrome the renderer
        // draws around it, which keeps the shared invariants meaningful: width / height
        // here is exactly the photo's real ratio, with no border arithmetic leaking in.
        width: round(innerWidth),
        height: round(innerHeight),
        // The card's box, in the same unit, so the renderer can derive the rim and the
        // contract can measure what actually lands on the sheet.
        card: {
          width: round(cardWidth),
          height: round(cardHeight),
          border: BORDER,
          lip: LIP,
        },
        tilt: frame.tilt,
        pile: true,
        cols: block.cols,
        gutter: 0,
        colWidth: round(block.colW * scale),
        family: 'collage-pile',
        _paint: frame.zIndex,
      }
    })
    // Paint order is what zIndex means, so the pile is sorted by the stacking the
    // family chose and then numbered 1..n.
    .sort((a, b) => a._paint - b._paint)
    .map((tile, index) => {
      const { _paint, ...rest } = tile
      return { ...rest, zIndex: index + 1 }
    })
}

export { BORDER, LIP, CARD_TALLEST, EDGE_ALLOWANCE, fitted }
