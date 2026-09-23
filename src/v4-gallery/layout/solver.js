// The one generic solver.
//
// Every template runs through this same pipeline. A template contributes data (a
// skeleton) and a list of capability names; it never contributes an algorithm.
// That is the property that makes the third, tenth and thirtieth template cheap:
// if the layout family already exists as a capability, a new template is a new
// file of numbers.
//
//   normalise → { for each candidate pitch: order → pack → score } → fit → report
//
// The search is over one free quantity — the unit size, i.e. how wide a square
// tile is as a fraction of the reserved area. The column count follows from it, so
// a single sweep covers both. The block is normalised into the reserved area
// afterwards, so only that fraction matters.

import { BOARD_WIDTH, aspectOf, buildQueue, normalizeAspect, seededRandom } from './geometry.js'
import { boardFor, zoneOf } from './skeleton.js'
import { capability } from './capabilities/index.js'
import { pack } from './capabilities/skyline.js'

const MIN_GUTTER = 0.9
const MAX_GUTTER = 1.5
// A single tile may not dominate the block; the reference stays well under half.
const MAX_TILE_SHARE = 0.5
// A sliver is a tile whose own shape is extreme — a very tall narrow strip or a
// flat band. Nothing about the reference looks like that at tile level, even
// though the block as a whole is quite wide, so it is scored separately from the
// block's shape.
const MIN_TILE_RATIO = 0.45
const MAX_TILE_RATIO = 1.35
// Columns must be deep enough to be worth having. With one photo per column the
// grid degenerates into a single row of tiles with a stepped skyline, which is the
// "row of images" look this layout exists to avoid — and it leaves interior gaps
// that no remaining photo can fill. Half the photos, rounded up, is the cap.
const MIN_TILES_PER_COLUMN = 2
// Unit-size sweep. This is a solver detail, not a template intent: it is the
// search grid for the one free quantity above.
const UNIT_MIN = 0.08
const UNIT_MAX = 0.62
const UNIT_STEP = 0.01

// How many photos a solve will place. The upload gate offers 6–13, and the number
// lives here as well because the solver is also called directly (by the tests and
// by the diagnostics view) with a list it did not receive from the page.
export const MAX_SOLVED_PHOTOS = 13

export function toEntries(photos) {
  return photos.slice(0, MAX_SOLVED_PHOTOS).map((photo, index) => {
    const normalized = normalizeAspect(aspectOf(photo))
    return { photo, index, ...normalized }
  })
}

// A placement that cannot form a block at all; the caller drops it.
function hopeless(deadColumns) {
  return {
    total: Infinity,
    columns: 0,
    offset: 0,
    blockRatio: 0,
    shape: 0,
    coverage: 0,
    usedArea: 0,
    fill: 0,
    band: 0,
    heroShare: 0,
    lean: 0,
    baseStep: 0,
    cornerShortfall: 0,
    tileScale: 0,
    tileShape: 0,
    medianHeight: 0,
    deadColumns,
    void: true,
  }
}

// Score one packed block. Lower is better. The terms, in rough order:
//   1. fill      — do not leave holes; the reference block is nearly solid;
//   2. usedArea  — what the uniform fit actually claims of the reserved area.
//                  This is what stops a tall narrow stripe from winning: a stripe
//                  can have a perfect packing density and still waste the canvas;
//   3. shape     — the block's own ratio, which the uniform scale turns into the
//                  result;
//   4. tileScale — how small the tiles are, compared with the template's own
//                  density intent. Fill and shape cannot tell four small columns
//                  from two huge ones;
//   5. edges     — a level bottom and filled corners.
//
// This version belongs to the `span-grid` family, the only one that packs against
// a skyline and can therefore leave interior notches. It lives here rather than in
// the capability because it was tuned against the golden fixture; a family whose
// rows are full by construction has nothing to say about skyline notches and
// supplies its own.
export function scoreSpanGrid(result, target) {
  const { tiles, bounds, gutter } = result
  const pitches = gutter + target.colW

  // A column no tile ever reached is a hole inside the block.
  let deadColumns = 0
  for (let c = 0; c < result.heights.length; c += 1) {
    if (result.heights[c] <= 0.5) deadColumns += 1
  }

  // Measure the block by the columns it actually occupies. Declared-but-unused
  // columns are phantom width, and if the mass sits at one end of the grid the
  // block is really that end, not the full grid.
  const live = []
  for (let c = 0; c < result.heights.length; c += 1) {
    if (result.heights[c] > 0.5) live.push(c)
  }
  if (!live.length || deadColumns > 0) return hopeless(deadColumns)
  const first = live[0]
  const last = live[live.length - 1]
  const used = last - first + 1

  const left = bounds.left + first * pitches
  const fullWidth = bounds.right - left
  const physicalHeight = bounds.bottom - bounds.top
  if (!(fullWidth > 0) || !(physicalHeight > 0)) return hopeless(deadColumns)

  const areas = tiles.map((tile) => tile.width * tile.height)
  const tileArea = areas.reduce((total, area) => total + area, 0)
  const fill = tileArea / (fullWidth * physicalHeight)
  const heroShare = Math.max(...areas) / tileArea

  const blockRatio = fullWidth / physicalHeight
  const shape = Math.abs(blockRatio - target.ratio)

  // What the block becomes after the uniform fit: the scale is set by the tighter
  // axis, so the other axis is left partly empty.
  const fit = Math.min(target.width / fullWidth, target.height / physicalHeight)
  const usedArea = (fullWidth * fit * physicalHeight * fit) / (target.width * target.height)

  // Longest run of adjacent columns that end at the same depth = a level band.
  const skyline = result.heights.slice(first, last + 1)
  let band = 1
  let run = 1
  for (let c = 1; c < skyline.length; c += 1) {
    if (Math.abs(skyline[c] - skyline[c - 1]) < 0.9) {
      run += 1
      band = Math.max(band, run)
    } else {
      run = 1
    }
  }

  // Optical centre of mass; a block that leans reads as "spilling".
  const centreX = tiles.reduce((total, tile) => total + (tile.x + tile.width / 2) * tile.width * tile.height, 0) / tileArea
  const lean = Math.abs(centreX - (left + fullWidth / 2)) / fullWidth

  // Below the deepest tile sits the tallest column; the shallower ones leave an
  // open step at the bottom edge. A modest step makes the base read as a base
  // rather than a sawtooth.
  const depths = skyline.filter((h) => h > 0.5)
  const baseStep = depths.length ? 1 - Math.min(...depths) / Math.max(...depths) : 1

  // Compactness. A block can have a good overall fill and still leave one big
  // open notch; a missing bottom corner is the ugliest version, because the block
  // then looks like it is falling over.
  const bottomEdge = bounds.bottom
  const reachOf = (edge, sign) => tiles.filter((tile) => {
    const nearEdge = sign > 0 ? tile.x + tile.width > edge - fullWidth * 0.3 : tile.x < edge + fullWidth * 0.3
    return nearEdge && tile.y + tile.height > bottomEdge - physicalHeight * 0.35
  }).length
  const cornerShortfall = (Math.max(0, 2 - reachOf(left, -1)) + Math.max(0, 2 - reachOf(left + fullWidth, 1))) / 4

  // Tile scale against the template's density intent. The skeleton says how many
  // tile rows the block should read as, and how much the unit may grow as more
  // photos arrive.
  const tileHeights = tiles.map((tile) => tile.height).sort((a, b) => a - b)
  const medianHeight = tileHeights[Math.floor(tileHeights.length / 2)]
  const wanted = (target.height / target.unitRows) * (tiles.length / target.unitBase) ** target.unitGrowth
  const tileScale = Math.abs(Math.log(medianHeight / wanted))

  // Tile slivers. `tileScale` matches the *size* of tiles but says nothing about
  // their shape, so a pitch narrow enough to make every tile a tall strip would
  // pass it. This is what stops the search from choosing more columns than the
  // photo count can fill: at some point the tiles stop being photos and become
  // strips.
  const tileRatios = tiles.map((tile) => tile.width / tile.height).sort((a, b) => a - b)
  const medianRatio = tileRatios[Math.floor(tileRatios.length / 2)]
  const tileShape = Math.max(0, MIN_TILE_RATIO / medianRatio - 1, medianRatio / MAX_TILE_RATIO - 1)

  const isVoid = target.voidDetector(tiles)

  return {
    total: (1 - fill) * 90
      + (1 - usedArea) * 55
      + shape * 10
      + tileScale * 30
      + tileShape * 120
      + deadColumns * 14
      + (used - band) * 1.2
      + Math.max(0, heroShare - MAX_TILE_SHARE) * 90
      + lean * 5
      + baseStep * 16
      + cornerShortfall * 14
      + (isVoid ? 40 : 0),
    columns: used,
    offset: first,
    blockRatio,
    shape,
    coverage: Math.min(fullWidth / target.width, physicalHeight / target.height),
    usedArea,
    fill,
    band,
    heroShare,
    lean,
    baseStep,
    cornerShortfall,
    tileScale,
    tileShape,
    medianHeight,
    deadColumns,
    void: isVoid,
  }
}

// The search for one template.
//
// Each capability owns how it enumerates candidate blocks for the photo set; the
// solver only asks for them, scores them with the same shared terms, and keeps the
// winner. That is what lets a new layout family be a new capability rather than a
// new branch in this function.
export function solveSkeleton(entries, skeleton, { voidDetector, seed }) {
  const zones = zoneOf(skeleton)
  const board = boardFor(skeleton)
  const [gutterMin, gutterMax] = skeleton.cluster.gutter ?? [0, 0]
  // The density intent only exists for families that size a unit (span-grid).
  // Families that solve their own unit do not carry one, so the fields are passed
  // through as undefined rather than assumed.
  const unitScale = skeleton.cluster.unitScale || {}
  // Where a stacking template wants its cards to cover one another. Declared per
  // template and read by the family that stacks; every other family ignores it.
  const [overlapMin, overlapMax] = skeleton.cluster.overlap ?? [0, 0]
  const target = {
    seed,
    board,
    width: zones.width,
    height: zones.height,
    ratio: zones.width / zones.height,
    zoneTop: zones.top,
    blockRatio: skeleton.cluster.blockRatio,
    maxTileRatio: skeleton.cluster.maxTileRatio,
    unitRows: unitScale.rows,
    unitBase: unitScale.base,
    unitGrowth: unitScale.growth,
    preferredOverlap: (overlapMin + overlapMax) / 2,
    // How much of the sheet a stacking template wants its photos to cover. Optional:
    // the family has its own defaults for when a template does not say.
    minCoverage: skeleton.cluster.coverage?.[0],
    maxCoverage: skeleton.cluster.coverage?.[1],
    minPhotoShare: skeleton.cluster.photoShare?.[0],
    voidDetector,
  }

  let best = null
  for (const capabilityName of skeleton.pipeline) {
    const engine = capability(capabilityName)
    for (const candidate of engine.blocks(entries, skeleton, {
      seed,
      zones,
      board,
      gutterMin,
      gutterMax,
      unitScale,
    })) {
      const scored = engine.score(candidate, { ...target, colW: candidate.colW, gutter: candidate.gutter })
      if (!Number.isFinite(scored.total)) continue
      if (!best || scored.total < best.total) {
        best = {
          cols: scored.columns,
          offset: scored.offset,
          colW: candidate.colW,
          gutter: candidate.gutter,
          order: candidate.order,
          family: candidate.family,
          capability: capabilityName,
          placed: candidate,
          scored,
          total: scored.total,
        }
      }
    }
  }
  return best
}

// Turn a packed block into board coordinates. One uniform scale for both axes:
// ratios stay exact and the gutter stays narrow. The block never grows past the
// reserved area on either axis.
//
// Vertical placement happens in board-height percent, which is what CSS `top`
// resolves against. The reserved zone is given in physical units (fractions of
// board width), so it is converted first — placing the block at the centre of the
// *board* instead of the centre of its *zone* is what let the block drift down
// onto the caption.
export function fitToBoard(placed, best, skeleton, board = boardFor(skeleton)) {
  const zones = zoneOf(skeleton)
  const offset = (best.scored.offset || 0) * (best.colW + best.gutter)
  const left = placed.bounds.left + offset
  const width = placed.bounds.right - left
  const height = placed.bounds.bottom - placed.bounds.top
  const scale = Math.min(zones.width / width, zones.height / height)

  // Everything below is in board percent, the space CSS `top` / `height` use.
  // Width and x are percent of board *width*; height and y are percent of board
  // *height*. To compare or combine a vertical value with a horizontal one it has
  // to be converted into width units, and how big that step is depends on the
  // board's own shape — 4:5 multiplies by 0.8, 4:3 by 1.333. That factor used to be
  // a constant inlined here (and, differently, in the checker and the renderer),
  // which is exactly what made the block drift and the tile ratios read wrong the
  // moment a second board ratio appeared. It now comes from ./board.js, the single
  // place that knows how the two axes relate.
  const { yFactor } = board
  const toBoardHeight = (physical) => physical * yFactor

  const blockWidth = width * scale
  const blockHeight = toBoardHeight(height * scale)
  const zoneTop = toBoardHeight(zones.top)
  const zoneBottom = toBoardHeight(zones.bottom)

  const offsetX = (BOARD_WIDTH - blockWidth) / 2
  // Centred inside the reserved zone, not inside the whole board: the zone is the
  // room the template kept for photos, and the space above and below it belongs to
  // the typography.
  const offsetY = (zoneTop + zoneBottom) / 2 - blockHeight / 2

  return placed.tiles
    .map((tile) => ({
      photo: tile.item.photo,
      id: tile.item.photo.id,
      role: 'tile',
      // True when the photo's real ratio had to be folded into the usable band,
      // so the caller can tell the user before rendering it.
      crop: tile.item.clamped,
      originalAspect: tile.item.original,
      x: offsetX + (tile.x - left) * scale,
      y: offsetY + toBoardHeight((tile.y - placed.bounds.top) * scale),
      width: tile.width * scale,
      height: toBoardHeight(tile.height * scale),
    }))
    .map((tile, index) => ({
      ...tile,
      zIndex: index + 1,
      cols: best.cols,
      gutter: best.gutter * scale,
      colWidth: best.colW * scale,
      fill: best.scored.fill,
    }))
}

export function solveTemplate(photos, skeleton, options) {
  const entries = toEntries(photos)
  if (!entries.length) return []
  const best = solveSkeleton(entries, skeleton, options)
  if (!best) return []
  return fitToBoard(best.placed, best, skeleton)
}
