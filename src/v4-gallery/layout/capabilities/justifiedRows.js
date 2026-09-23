// Capability: justified rows.
//
// This is the technique the reference layouts actually use, and it is a different
// family from `span-grid`:
//
//   span-grid        N equal-width columns, each photo spans columns.
//                    => every tile has the SAME WIDTH, heights vary.
//                    => reads as a tidy grid of blocks.
//
//   justified-rows   photos group into rows; each row's height is SOLVED so that
//                    the widths (height x real ratio) fill the row exactly.
//                    => every tile in a row has the SAME HEIGHT, widths vary with
//                       each photo's own ratio.
//                    => reads as an edited photo strip, matching the reference.
//
// That difference is the whole reason the first attempt at this template looked
// like a grid however it was tuned: with one column pitch, uniform tile width is
// not a bug, it is arithmetic.
//
// Capabilities are pure: they return candidate blocks and let ./skyline.js or
// ../../solver.js do the choosing.

import { clamp } from '../geometry.js'

// Fraction of the reserved width that the widest row justifies to. Reaching the
// very edge turns the block into a horizontal banner; leaving a margin is what
// keeps a portrait-leaning set reading as a vertical stack.
const DEFAULT_JUSTIFY = 0.84
// Past this on-screen flatness a tile is a banner rather than a photo. Flatness is
// width / (height x FRAME_ASPECT) because width and height are in different units.
const DEFAULT_MAX_TILE_RATIO = 3.2
// Only an upright photo suits a two-row pillar; a landscape one would have to
// become a narrow slot to keep its ratio at double height.
const PILLAR_RATIO_MAX = 0.9
// A pillar may take at most this share of its row's width. Beyond that the row is
// one big slab beside squeezed slivers, which is worse than having no pillar.
const PILLAR_ROW_SHARE = 0.36
// Row width taper, as a share of the widest row. It is monotonically decreasing,
// so the top row is widest and each row below pulls in. That gives the stepped
// edge the references have.
//
// Monotonicity is also what makes the stagger safe. Rows are placed on a shared
// left edge, so a narrower row always sits inside the wider row above it and
// overhang cannot happen — no collision test is needed. (Centring each row
// independently would *not* be safe: a narrower row centred inside a wider one
// still begins to the right of it, which is exactly how the first attempt
// collided.)
const TAPER = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64]
// How many taper steps to move per row down the stack. Above 1 the block tapers
// faster, which reads as more deliberate.
const TAPER_RATE = 1.4

const sortedIndices = (ratios, order) => {
  const indices = [...ratios.keys()]
  if (order === 'wide') return indices.sort((a, b) => ratios[b] - ratios[a])
  if (order === 'narrow') return indices.sort((a, b) => ratios[a] - ratios[b])
  return indices
}

// Target width for the row at `indexInStack`. This version walks monotonically
// down from the top so the silhouette steps inward as it descends, and so rows can
// share a left edge safely.
function rowTarget(indexInStack, rowCount, justifyTo, taper, taperRate) {
  const step = Math.min(taper.length - 1, Math.round(indexInStack * taperRate))
  // Normalised by the taper's own maximum, so the widest row lands exactly on the
  // justified width. Without this the taper would eat into every row — including
  // the first — and the whole block would come out smaller for no reason.
  const peak = Math.max(...taper)
  return justifyTo * (taper[step] / peak)
}

// Candidate partitions of the photos into rows. Row heights are not searched: once
// a partition is chosen the heights follow from the row widths, which is exactly
// what makes every row justify.
export function candidates(ratios, settings) {
  const { gutter, justifyTo, taper, taperRate } = settings
  const n = ratios.length
  const found = []
  const seen = new Set()

  for (const order of ['wide', 'narrow', 'natural']) {
    const indices = sortedIndices(ratios, order)
    for (let rowsWanted = 2; rowsWanted <= Math.min(n, 7); rowsWanted += 1) {
      // Contiguous, near-even groups. Even groups keep the rows comparable, and a
      // row with far fewer photos than its neighbours is the "one big image beside
      // a column of small ones" look the reference never has.
      const rows = []
      let cursor = 0
      for (let r = 0; r < rowsWanted; r += 1) {
        const take = Math.ceil((n - cursor) / (rowsWanted - r))
        rows.push(indices.slice(cursor, cursor + take))
        cursor += take
      }
      const key = rows.map((row) => row.join(',')).join('|')
      if (seen.has(key)) continue
      seen.add(key)
      const laid = layoutRows(rows, ratios, { gutter, justifyTo, taper, taperRate })
      if (laid) found.push(laid)
    }
  }
  return found
}

// Solve each row so its tiles fill that row's target width exactly:
//     sum(h * ratio) + gutters = target   =>   h = (target - gutters) / sum(ratio)
//
// A pillar is the one tile whose width cannot be chosen freely, because its height
// is fixed at two rows and its ratio is fixed:
//     height = 2h + gutter            (two rows plus the gutter between them)
//     width  = height * ratio / 2     (a pillar is half as wide as it is tall)
// So the row is solved from its single-height tiles first, the pillar's width then
// follows, and the row is re-solved against whatever width is left. That two-pass
// order is what keeps a pillar from overhanging into the row below.
//
// Rows also march: each row's target is capped by the row above it, because a row
// wider than its neighbour would overhang it. With the cap and centring, overlap is
// impossible by construction and no collision test is needed.
function layoutRows(rows, ratios, { gutter, justifyTo, taper, taperRate, allowPillars }) {
  const laid = []
  let cap = Infinity

  for (let r = 0; r < rows.length; r += 1) {
    const indices = rows[r]
    if (!indices.length) return null
    const target = Math.min(cap, rowTarget(r, rows.length, justifyTo, taper, taperRate))

    let pillar = null
    if (allowPillars && r < rows.length - 1 && indices.length > 1) {
      // Upright photos only, tallest shape first: those gain the most from double
      // height and need the least width for it.
      const upright = indices.filter((index) => ratios[index] <= PILLAR_RATIO_MAX)
      if (upright.length) pillar = upright.sort((a, b) => ratios[a] - ratios[b])[0]
    }

    const solo = pillar === null ? indices : indices.filter((index) => index !== pillar)
    if (!solo.length) return null

    const solve = (reserved) => {
      const sum = solo.reduce((total, index) => total + ratios[index], 0)
      const inner = target - reserved - gutter * (solo.length - 1)
      if (inner <= 0 || sum <= 0) return null
      return inner / sum
    }

    let height = solve(0)
    if (height === null) return null

    let pillarWidth = 0
    let pillarHeight = 0
    if (pillar !== null) {
      const pillarWidthFor = (h) => ((h * 2 + gutter) * ratios[pillar]) / 2
      pillarWidth = pillarWidthFor(height)
      pillarHeight = height * 2 + gutter
      if (pillarWidth > target * PILLAR_ROW_SHARE) {
        pillar = null
        pillarWidth = 0
        pillarHeight = 0
      } else {
        const reserved = pillarWidth + gutter
        const next = solve(reserved)
        if (next === null || next <= 0) {
          pillar = null
          pillarWidth = 0
          pillarHeight = 0
        } else {
          height = next
          pillarWidth = pillarWidthFor(height)
          pillarHeight = height * 2 + gutter
        }
      }
    }

    const singles = solo.map((index) => ({ index, ratio: ratios[index], width: height * ratios[index] }))
    const rowWidth = (pillar !== null ? pillarWidth + gutter : 0)
      + singles.reduce((total, tile) => total + tile.width, 0)
      + gutter * (singles.length - 1)
    if (!(rowWidth > 0)) return null

    laid.push({
      height,
      pillar: pillar === null ? null : { index: pillar, ratio: ratios[pillar], width: pillarWidth, height: pillarHeight },
      tiles: singles,
      width: rowWidth,
    })
    cap = rowWidth
  }
  return laid
}

// Place the solved rows and measure the block. Every row is full by construction,
// so the interesting numbers are the block's proportion and how ragged its
// silhouette is.
export function measure(laid, entries, settings) {
  const { gutter, maxTileRatio, justifyTo } = settings
  const tiles = []
  // Every row starts on the same left edge. Because row widths are monotonically
  // decreasing, a narrower row is always nested inside the wider row above it, so
  // a staggered row cannot overhang its neighbour.
  const widestRow = Math.max(...laid.map((row) => row.width))
  const left = (justifyTo - widestRow) / 2
  let y = 0
  for (const row of laid) {
    let x = left
    if (row.pillar) {
      // Tiles carry `item` so the solver's fit step can read the photo and its
      // clamped ratio without knowing which family produced the block.
      tiles.push({
        item: entries[row.pillar.index],
        x,
        y,
        width: row.pillar.width,
        height: row.pillar.height,
      })
      x += row.pillar.width + gutter
    }
    for (const tile of row.tiles) {
      tiles.push({ item: entries[tile.index], x, y, width: tile.width, height: row.height })
      x += tile.width + gutter
    }
    y += row.height + gutter
  }

  const right = Math.max(...tiles.map((tile) => tile.x + tile.width))
  const height = Math.max(...tiles.map((tile) => tile.y + tile.height))
  const width = right - left
  const area = tiles.reduce((total, tile) => total + tile.width * tile.height, 0)
  const flat = tiles.filter((tile) => tile.width / (tile.height * 0.8) > maxTileRatio).length
  const rowCounts = laid.map((row) => row.tiles.length + (row.pillar ? 1 : 0))
  const widest = Math.max(...rowCounts)

  return {
    tiles,
    bounds: { left: 0, top: 0, right: width, bottom: height },
    rowFills: laid.map((row) => Math.min(1, row.width / justifyTo)),
    rowCounts,
    rowWidths: laid.map((row) => row.width),
    pillars: laid.filter((row) => row.pillar).length,
    blockRatio: width / height,
    // Tiles are all inside the block by construction, so density is the real fill.
    fill: area / (width * height),
    flat,
    imbalance: rowCounts.reduce((total, count) => total + Math.abs(widest - count), 0) / rowCounts.length,
    // How much the silhouette departs from a rectangle. Some is wanted — it is the
    // "grew outward" edge — too much is a scatter.
    silhouette: laid.length > 1
      ? laid.reduce((total, row) => total + Math.abs(row.width - widestRow) / widestRow, 0) / laid.length
      : 0,
    heights: [],
  }
}

// Family-specific scoring. The common terms (fill, usedArea, shape, hero share,
// per-tile ratio) are re-checked here so a template cannot escape them by switching
// capability; these are the terms only this family has an opinion about.
export function extraCost(block, target) {
  return (1 - block.fill) * 40
    + Math.abs(block.blockRatio - target.blockRatio) * 75
    + block.imbalance * 6
    + Math.max(0, block.flat - 1) * 18
    + Math.max(0, block.rowCounts.length - 6) * 3
}

export function settingsFor(skeleton) {
  const zone = skeleton.cluster.zone
  const zoneWidth = zone.right - zone.left
  const gutter = Math.min(
    skeleton.cluster.gutter[1],
    Math.max(skeleton.cluster.gutter[0], zoneWidth * 0.012),
  )
  const justifyTo = zoneWidth * (skeleton.cluster.justify ?? DEFAULT_JUSTIFY)
  return {
    gutter,
    justifyTo,
    taper: skeleton.cluster.taper ?? TAPER,
    taperRate: skeleton.cluster.taperRate ?? TAPER_RATE,
    // The taper is expressed against the row target, so the widest row lands on the
    // justified width and the others pull in from it.
    maxTileRatio: skeleton.cluster.maxTileRatio ?? DEFAULT_MAX_TILE_RATIO,
    blockRatio: skeleton.cluster.blockRatio ?? 1,
  }
}

/**
 * Every candidate block this family can make for the photo set, shaped like the
 * skyline packer's result so the solver can score and fit them without knowing
 * which family produced them.
 */
export function blocks(entries, skeleton) {
  const ratios = entries.map((entry) => entry.placed)
  const settings = settingsFor(skeleton)
  const found = []
  for (const laid of candidates(ratios, settings)) {
    const measured = measure(laid, entries, settings)
    found.push({
      ...measured,
      entries,
      settings,
      family: 'justified-rows',
      gutter: settings.gutter,
      colW: settings.gutter,
      cols: Math.max(...measured.rowCounts),
      order: 'rows',
      offset: 0,
    })
  }
  return found
}

// Same shape of verdict as the span-grid scorer, plus the terms only this family
// can have an opinion about. The common invariants are re-checked here so a
// template cannot escape them by switching capability.
export function score(block, target) {
  const { tiles, bounds, gutter } = block
  const fullWidth = bounds.right - bounds.left
  const physicalHeight = bounds.bottom - bounds.top
  if (!(fullWidth > 0) || !(physicalHeight > 0)) return { total: Infinity }

  const areas = tiles.map((tile) => tile.width * tile.height)
  const tileArea = areas.reduce((total, area) => total + area, 0)
  const fill = tileArea / (fullWidth * physicalHeight)
  const heroShare = Math.max(...areas) / tileArea
  const blockRatio = fullWidth / physicalHeight

  const fit = Math.min(target.width / fullWidth, target.height / physicalHeight)
  const usedArea = (fullWidth * fit * physicalHeight * fit) / (target.width * target.height)

  // No tile may become a banner: a photo flatter than this stops reading as a
  // photo and starts reading as a rule.
  const banner = tiles.reduce(
    (worst, tile) => Math.max(worst, tile.width / (tile.height * 0.8)),
    0,
  )

  const voidDetector = target.voidDetector
  const isVoid = voidDetector ? voidDetector(tiles) : false

  return {
    total: (1 - fill) * 90
      + (1 - usedArea) * 55
      + Math.abs(blockRatio - (target.blockRatio ?? 1)) * 75
      + block.imbalance * 6
      + Math.max(0, banner - (target.maxTileRatio ?? 3.2)) * 30
      + Math.max(0, block.rowCounts.length - 6) * 3
      // Some silhouette raggedness is the point — it is the "grew outward" edge —
      // but a block that is mostly empty canvas is a scatter, not a composition.
      + Math.max(0, block.silhouette - 0.22) * 60
      + Math.max(0, heroShare - 0.5) * 90
      + (isVoid ? 40 : 0),
    columns: Math.max(...block.rowCounts),
    offset: 0,
    blockRatio,
    shape: Math.abs(blockRatio - (target.blockRatio ?? 1)),
    coverage: Math.min(fullWidth / target.width, physicalHeight / target.height),
    usedArea,
    fill,
    band: block.rowCounts.length,
    heroShare,
    lean: 0,
    baseStep: 0,
    cornerShortfall: 0,
    tileScale: 0,
    tileShape: 0,
    medianHeight: 0,
    deadColumns: 0,
    silhouette: block.silhouette,
    pillars: block.pillars,
    void: isVoid,
  }
}

export { DEFAULT_JUSTIFY, DEFAULT_MAX_TILE_RATIO }
