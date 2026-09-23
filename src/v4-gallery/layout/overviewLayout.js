// V4 Gallery — public layout API.
//
// This module is the only thing the page and the tests import. It holds no
// algorithm: it looks up the active template's skeleton and hands it to the one
// generic solver in ./solver.js. Everything a template contributes is data, which
// is what lets later templates be cheap.
//
// The export surface here is deliberately unchanged from before the refactor, so
// the page did not have to move.

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  MAX_RATIO,
  MIN_RATIO,
  aspectOf,
  buildQueue,
  intersectionOf,
  overlapArea,
  overlaps,
  seededRandom,
} from './geometry.js'
import { MAX_SOLVED_PHOTOS, fitToBoard, solveSkeleton, toEntries } from './solver.js'
import { formatReport, hasEnclosedVoid, verifyContract } from './contract.js'
import { describeSuggestion, validateSkeleton, zoneOf } from './skeleton.js'
import { DEFAULT_BOARD, boardFor } from './board.js'
import { overviewTextFor } from './text.js'
import { capability } from './capabilities/index.js'
import { pack } from './capabilities/skyline.js'
import { DEFAULT_TEMPLATE_ID, allTemplates, getTemplate, validateAllTemplates } from '../templates/index.js'

export { BOARD_HEIGHT, BOARD_WIDTH, MAX_RATIO, MIN_RATIO, aspectOf, intersectionOf, overlapArea, overlaps, seededRandom }
export { buildQueue, normalizeAspect, clamp } from './geometry.js'
export { RATIO_HINT, RECOMMENDED_FORMATS, REFUSED_FORMATS, describeRejection, isAcceptedRatio, nearestFormat, partitionByRatio, ratioOf } from './ratioPolicy.js'
export { describeSuggestion, validateSkeleton, zoneOf } from './skeleton.js'
export { DEFAULT_BOARD, BOARD_PRESETS, boardAspectStyle, boardFor, boardRatioKey, supportedBoardRatios } from './board.js'
export { MAX_SOLVED_PHOTOS } from './solver.js'
export { formatReport, verifyContract, hasEnclosedVoid } from './contract.js'
export { registeredCapabilities } from './capabilities/index.js'
export { allTemplates, DEFAULT_TEMPLATE_ID, getTemplate, validateAllTemplates } from '../templates/index.js'

// Static typography preset for the default template, so the photo block can be
// judged inside the composition it was designed for.
export const OVERVIEW_TEXT = overviewTextFor(getTemplate(DEFAULT_TEMPLATE_ID))
// Typography for whichever template is active. A second template brings its own
// composition rather than borrowing the first one's words.
export { overviewTextFor }

const solveOptions = (seed) => ({ seed, voidDetector: hasEnclosedVoid })

export function buildGalleryOverview(photos, seed = 'gallery-01', templateId = DEFAULT_TEMPLATE_ID) {
  return solveTemplateWith(getTemplate(templateId), photos, seed)
}

// Solve with an explicit skeleton — the entry point a template picker will use,
// and the one the golden fixture and tests drive directly.
export function solveTemplateWith(skeleton, photos, seed = 'gallery-01') {
  const entries = toEntries(photos)
  if (!entries.length) return []
  const best = solveSkeleton(entries, skeleton, solveOptions(seed))
  if (!best) return []
  const board = boardFor(skeleton)
  // A family whose frames are rotated needs a centre-anchored fit, because a
  // rotation happens about the centre; everything else uses the shared
  // corner-anchored one.
  if (typeof best.placed.materialize === 'function') {
    return best.placed.materialize(zoneOf(skeleton), board)
  }
  return fitToBoard(best.placed, best, skeleton, board)
}

// Debug/pacing helper: the solver's internal decisions, so the geometry can be
// inspected without guessing from the rendered page.
export function describeOverview(photos, seed = 'gallery-01', templateId = DEFAULT_TEMPLATE_ID) {
  const skeleton = getTemplate(templateId)
  const entries = toEntries(photos)
  if (!entries.length) return null
  const best = solveSkeleton(entries, skeleton, solveOptions(seed))
  if (!best) return null
  const rotatable = typeof best.placed.materialize === 'function'
  const layout = solveTemplateWith(skeleton, photos, seed)
  const pitch = best.colW + best.gutter

  return {
    cols: best.cols,
    colW: best.colW,
    gutter: best.gutter,
    order: best.order,
    capability: best.capability,
    score: best.scored,
    contract: verifyContract(layout, skeleton),
    tiles: best.placed.tiles
      ? best.placed.tiles.map((tile) => {
        const rendered = layout.find((entry) => entry.id === tile.item.photo.id)
        return {
          index: tile.item.index,
          span: Math.max(1, Math.min(best.cols, Math.round((tile.item.placed * pitch + best.gutter) / pitch))),
          natural: { x: tile.x, y: tile.y, width: tile.width, height: tile.height },
          board: { x: rendered.x, y: rendered.y, width: rendered.width, height: rendered.height },
          ratio: tile.item.placed,
          original: tile.item.original,
          clamped: tile.item.clamped,
        }
      })
      : [],
    frames: rotatable
      ? layout.map((tile) => ({
        id: tile.id,
        centreX: tile.centreX,
        centreY: tile.centreY,
        width: tile.width,
        height: tile.height,
        tilt: tile.tilt,
      }))
      : [],
  }
}

// Diagnostic entry point: every candidate the solver considered, so the objective
// can be tuned against real numbers instead of guesses. Works for any capability,
// because it asks each one for its own candidates.
export function sweepCandidates(photos, seed = 'gallery-01', templateId = DEFAULT_TEMPLATE_ID) {
  const skeleton = getTemplate(templateId)
  const entries = toEntries(photos)
  const zones = zoneOf(skeleton)
  const [gutterMin, gutterMax] = skeleton.cluster.gutter
  const { unitScale } = skeleton.cluster
  const target = {
    seed,
    width: zones.width,
    height: zones.height,
    ratio: zones.width / zones.height,
    unitRows: unitScale.rows,
    unitBase: unitScale.base,
    unitGrowth: unitScale.growth,
    blockRatio: skeleton.cluster.blockRatio,
    maxTileRatio: skeleton.cluster.maxTileRatio,
    voidDetector: hasEnclosedVoid,
  }

  const rows = []
  for (const capabilityName of skeleton.pipeline) {
    const engine = capability(capabilityName)
    for (const block of engine.blocks(entries, skeleton, { seed, zones, gutterMin, gutterMax, unitScale })) {
      const scored = engine.score(block, { ...target, colW: block.colW, gutter: block.gutter })
      rows.push({
        k: zones.width ? block.colW / zones.width : 0,
        colW: block.colW,
        cols: block.cols ?? scored.columns,
        order: block.order,
        capability: capabilityName,
        rows: block.rowCounts,
        blockRatio: scored.blockRatio,
        total: scored.total,
        coverage: scored.coverage,
        shape: scored.shape,
        fill: scored.fill,
        band: scored.band,
        tileScale: scored.tileScale,
        dead: scored.deadColumns,
        finite: Number.isFinite(scored.total),
      })
    }
  }
  return rows
}

export function obscurersFor(selected, layout) {
  return layout.filter((tile) => tile.zIndex > selected.zIndex && overlaps(tile, selected))
}

// The viewport, not the photo, moves. This keeps every image in the same collage
// coordinate system while bringing the selected frame closer.
export function focusCameraFor(tile, board = DEFAULT_BOARD) {
  // A tile's height is a percent of board HEIGHT, so it converts into the same units
  // as its width through the board before the two can be compared.
  const visualSize = Math.max(tile.width, board.toWidthUnits(tile.height))
  const scale = Math.max(1.35, Math.min(2.6, 68 / visualSize))
  // The camera moves in the overview's own percentage space, which is board percent
  // on both axes — so the vertical target stays in board-height percent.
  const centerX = tile.x + tile.width / 2
  const centerY = tile.y + tile.height / 2
  return {
    scale,
    translateX: 50 - scale * centerX,
    translateY: 50 - scale * centerY,
  }
}
