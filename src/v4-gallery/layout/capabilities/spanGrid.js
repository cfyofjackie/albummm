// Capability: N equal columns with variable per-photo spans.
//
// This is what makes a block read as one contact sheet rather than a stack of
// bands: one column pitch, and each photo takes as many columns as its real ratio
// needs. It knows nothing about stacking; the skyline packer decides where each
// tile goes.
//
// NOTE ON FAMILIES. Because the pitch is fixed, every tile ends up the same width.
// That is arithmetic, not a tuning failure, and it is why a template built on this
// capability reads as a tidy grid of blocks however it is tuned. A strip-like
// composition — uniform height within a row, widths varying with each photo's own
// ratio — needs `justified-rows` instead.

import { buildQueue, seededRandom } from '../geometry.js'
import { columnsFor } from '../skeleton.js'
import { scoreSpanGrid } from '../solver.js'
import { pack } from './skyline.js'

// Pitch sweep: how wide a square tile is, as a fraction of the reserved area. The
// column count follows from it, so one sweep covers both.
const UNIT_MIN = 0.08
const UNIT_MAX = 0.62
const UNIT_STEP = 0.01
// Columns must be deep enough to be worth having. With one photo per column the
// grid degenerates into a single row with a stepped skyline, and it leaves interior
// gaps that no remaining photo can fill.
const MIN_TILES_PER_COLUMN = 2

/**
 * Every candidate block this family can make for the photo set. The solver asks
 * each capability in the pipeline for these and keeps the best-scoring one.
 */
export function blocks(entries, skeleton, { seed, zones, gutterMin, gutterMax }) {
  const found = []
  for (const order of ['mixed', 'sorted']) {
    for (let k = UNIT_MIN; k <= UNIT_MAX; k += UNIT_STEP) {
      const colW = zones.width * k
      const gutter = Math.min(gutterMax, Math.max(gutterMin, colW * 0.055))
      const cols = Math.min(
        columnsFor(skeleton, colW, gutter),
        Math.max(1, Math.ceil(entries.length / MIN_TILES_PER_COLUMN)),
      )
      const random = seededRandom(`${seed}:${Math.round(k * 1000)}`)
      const queue = buildQueue(entries, random, order)
      const placed = pack(queue, { candidates }, { cols, colW, gutter, random })
      if (!placed) continue
      found.push({ ...placed, colW, cols, order, family: 'span-grid' })
    }
  }
  return found
}

export function score(block, target) {
  return scoreSpanGrid(block, target)
}

/**
 * Positions this photo could take on the current skyline. Pure: it reads the
 * skyline it is handed and never commits a tile.
 *
 * @param item     a photo already normalised to { placed, original, clamped }
 * @param state    { cols, colW, gutter, heights }
 * @returns array of { start, span, base, width, height, cost }
 */
export function candidates(item, { cols, colW, gutter, heights }) {
  const pitch = colW + gutter
  const span = Math.max(1, Math.min(cols, Math.round((item.placed * pitch + gutter) / pitch)))
  const lastStart = cols - span
  if (lastStart < 0) return []

  const width = span * pitch - gutter
  const height = width / item.placed
  const found = []

  for (let start = 0; start <= lastStart; start += 1) {
    let base = 0
    for (let c = start; c < start + span; c += 1) base = Math.max(base, heights[c])
    // Stay near the middle: the reference block is at its fullest in the centre
    // and steps back down toward both edges.
    const cost = Math.abs((start + span / 2) / cols - 0.5) * 0.5
    found.push({ start, span, base, width, height, cost })
  }

  return found
}
