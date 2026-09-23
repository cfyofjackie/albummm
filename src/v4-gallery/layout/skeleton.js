// Template skeleton: the declarative half of a layout.
//
// A skeleton describes *relationships and tendencies* — how much room the photo
// block gets, how tight its gutter is, how dense its units should read, how many
// photos it expects — and which generic capabilities the solver should run. It
// contains no algorithm and no fixed coordinates: the concrete x/y/width/height
// of every photo is re-solved from the photos actually uploaded.
//
// That is the whole point. A template must keep its structure and its feel while
// the numbers follow the real image ratios, otherwise it is just a stencil that
// crops whatever does not fit.

import {
  DEFAULT_BOARD_RATIO,
  boardFor,
  boardRatioKey,
  isSupportedBoardRatio,
  supportedBoardRatios,
  zoneOf,
} from './board.js'

// Re-exported so `skeleton.js` stays the one import a consumer needs for template
// vocabulary. The implementations live in ./board.js, which owns every coordinate
// conversion in the codebase.
export { DEFAULT_BOARD_RATIO, boardFor, boardRatioKey, zoneOf }

// Ratios a skeleton may ask for. Kept explicit so a template asking for anything
// else fails loudly instead of silently producing a wrong board.
export const SUPPORTED_BOARD_RATIOS = supportedBoardRatios()

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const isRange = (value) => Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber) && value[0] <= value[1]
const isUnitInterval = (value) => isFiniteNumber(value) && value >= 0 && value <= 1

// Validate early and loudly. A typo in a template is the most likely way to get a
// silently bad layout, and a skeleton is pure data so it can be checked cheaply.
export function validateSkeleton(skeleton) {
  const problems = []
  const require = (condition, message) => { if (!condition) problems.push(message) }

  require(skeleton && typeof skeleton === 'object', '骨架必须是对象')
  if (problems.length) return problems

  require(typeof skeleton.id === 'string' && skeleton.id.length > 0, '缺少 id')
  require(skeleton.board && Array.isArray(skeleton.board.ratio), '缺少 board.ratio')
  if (skeleton.board?.ratio) {
    const key = boardRatioKey(skeleton.board.ratio)
    require(isSupportedBoardRatio(skeleton.board.ratio), `暂不支持的画布比例 ${key}，目前支持 ${SUPPORTED_BOARD_RATIOS.join(' / ')}`)
  }
  // A board is a sheet of paper, so it is landscape or portrait — never square and
  // never degenerate. A square board would make the two coordinate axes identical,
  // which hides exactly the conversion bug this file's comments exist to prevent.
  if (Array.isArray(skeleton.board?.ratio)) {
    const [w, h] = skeleton.board.ratio
    require(isFiniteNumber(w) && isFiniteNumber(h) && w > 0 && h > 0, 'board.ratio 必须是两个正数')
  }

  require(Array.isArray(skeleton.pipeline) && skeleton.pipeline.length > 0, 'pipeline 至少需要一个能力')
  require(skeleton.cluster && typeof skeleton.cluster === 'object', '缺少 cluster')

  const cluster = skeleton.cluster || {}
  const board = boardFor(skeleton)
  const zone = cluster.zone
  require(zone && isFiniteNumber(zone.left) && isFiniteNumber(zone.right), 'cluster.zone 缺少 left/right')
  require(zone && isFiniteNumber(zone.top) && isFiniteNumber(zone.bottom), 'cluster.zone 缺少 top/bottom')

  // How much the photos may run past the edge of the sheet, as a percent of the
  // board — the same base as every other cluster number. Zero — and therefore the old
  // "everything must be inside the canvas" rule — unless a template says otherwise,
  // because a full-bleed collage is the only family that wants it.
  //
  // The bound is loose because a rotated card's own corner already reaches a fifth
  // past its box at the tilts this family uses, so the allowance has to be able to
  // cover that as well as the fit's overshoot. A quarter of the board is the ceiling:
  // past that the outer prints are mostly off the sheet, which is a different
  // composition rather than a bolder bleed.
  const bleed = cluster.bleed ?? 0
  const maxBleed = Math.min(board.width, board.height) * 0.25
  require(isFiniteNumber(bleed) && bleed >= 0 && bleed <= maxBleed, `cluster.bleed 必须是 0–${maxBleed.toFixed(0)} 之间（画布百分比）`)

  if (zone && isFiniteNumber(zone.left) && isFiniteNumber(zone.right)) {
    require(zone.left >= -bleed && zone.right <= board.width + bleed, 'cluster.zone 横向超出画布')
    require(zone.right > zone.left, 'cluster.zone 横向区间无效')
  }
  if (zone && isFiniteNumber(zone.top) && isFiniteNumber(zone.bottom)) {
    // Vertical values are in width units by default; a skeleton that styles its own
    // typography may give them as percent of board height instead, which is what CSS
    // does, by declaring `cluster.verticalAxis: 'height'`.
    const base = cluster.verticalAxis === 'height' ? board.height / 100 : 1
    // The bleed is a percent of the BOARD, so it converts with the same factor: else
    // the allowance is wider on one axis than the other and a full-bleed sheet fails
    // validation for a reason nothing in the layout can see.
    const slack = bleed * base
    const top = zone.top * base
    const bottom = zone.bottom * base
    require(top >= -slack && bottom <= board.height + slack, 'cluster.zone 纵向超出画布')
    require(zone.bottom > zone.top, 'cluster.zone 纵向区间无效')
  }

  require(cluster.verticalAxis === undefined || cluster.verticalAxis === 'width' || cluster.verticalAxis === 'height', 'cluster.verticalAxis 只能是 width 或 height')

  require(isRange(cluster.gutter), 'cluster.gutter 必须是 [min, max]')
  // The density intent is what the span-grid family needs to size its unit. A
  // family that solves its own unit (justified rows) does not use it, so it is
  // only checked when present — but when present it must be complete.
  if (cluster.unitScale) {
    require(isFiniteNumber(cluster.unitScale.rows) && cluster.unitScale.rows > 0, 'cluster.unitScale.rows 必须是正数')
    require(isFiniteNumber(cluster.unitScale.base) && cluster.unitScale.base > 0, 'cluster.unitScale.base 必须是正数')
    require(isFiniteNumber(cluster.unitScale.growth), 'cluster.unitScale.growth 必须是数字')
  }
  if (cluster.justify !== undefined) {
    require(isFiniteNumber(cluster.justify) && cluster.justify > 0 && cluster.justify <= 1, 'cluster.justify 必须是 (0, 1] 之间的小数')
  }
  if (cluster.cols !== undefined) {
    require(isRange(cluster.cols), 'cluster.cols 必须是 [min, max] 且 min <= max')
  }
  if (cluster.columns !== undefined) {
    require(isRange(cluster.columns), 'cluster.columns 必须是 [min, max] 且 min <= max')
  }

  // The stacking family's own declaration. Every one of these is optional, because
  // only that family reads them; but a value that is present must make sense, or
  // the solver silently produces stamps or a grey mush.
  if (cluster.perRow !== undefined) {
    require(isRange(cluster.perRow) && cluster.perRow[0] >= 2, 'cluster.perRow 必须是 [min, max] 且 min >= 2')
  }
  if (cluster.overlap !== undefined) {
    require(isRange(cluster.overlap), 'cluster.overlap 必须是 [min, max]')
    require(cluster.overlap.every(isUnitInterval), 'cluster.overlap 必须落在 0–1 之间')
  }
  if (cluster.rowOverlap !== undefined) {
    require(isUnitInterval(cluster.rowOverlap), 'cluster.rowOverlap 必须是 0–1 之间的小数')
  }
  if (cluster.tilt !== undefined) {
    require(isFiniteNumber(cluster.tilt) && cluster.tilt >= 0 && cluster.tilt <= 45, 'cluster.tilt 必须是 0–45 之间的角度')
  }
  if (cluster.jitter !== undefined) {
    require(isUnitInterval(cluster.jitter), 'cluster.jitter 必须是 0–1 之间的小数')
  }
  if (cluster.frameTallest !== undefined) {
    require(isFiniteNumber(cluster.frameTallest) && cluster.frameTallest >= 1, 'cluster.frameTallest 必须 >= 1')
  }
  if (cluster.widthSteps !== undefined) {
    require(isFiniteNumber(cluster.widthSteps) && cluster.widthSteps >= 1, 'cluster.widthSteps 必须是 >= 1 的数字')
  }

  const suggest = skeleton.suggest || {}
  require(isRange(suggest.photos), 'suggest.photos 必须是 [min, max]')

  // Text bands must be ordered and inside the board, or a caption can silently
  // land off-canvas. A template with no typography declares no fields, which is a
  // legitimate answer — 满幅拼贴 prints photos on blank paper.
  const fields = skeleton.fields ?? {}
  require(fields && typeof fields === 'object' && !Array.isArray(fields), 'fields 必须是对象')
  for (const [name, field] of Object.entries(fields)) {
    if (!field.band) continue
    const { left, right, top, bottom } = field.band
    require(isFiniteNumber(left) && isFiniteNumber(right) && isFiniteNumber(top) && isFiniteNumber(bottom), `fields.${name}.band 必须是数字`)
    if (isFiniteNumber(top) && isFiniteNumber(bottom)) {
      require(bottom > top, `fields.${name}.band 纵向区间无效`)
    }
  }

  return problems
}

// How many columns the skeleton's own geometry implies for a given pitch. Shared
// so every capability agrees on what "N columns" means. Only the span-grid family
// needs it, so it falls back to the skeleton's declared grid when absent.
export function columnsFor(skeleton, colW, gutter) {
  const zoneW = zoneOf(skeleton).width
  const [min, max] = skeleton.cluster.cols ?? skeleton.cluster.columns ?? [1, 8]
  const raw = Math.round((zoneW + gutter) / (colW + gutter))
  return Math.max(min, Math.min(max, raw))
}

// The one-line hint shown on a template card, before the user has uploaded
// anything. It is derived from the skeleton rather than hand-written, so the
// promise on the card cannot drift away from what the solver actually does.
export function describeSuggestion(skeleton) {
  const [minPhotos, maxPhotos] = skeleton.suggest.photos
  const hint = skeleton.suggest.orientation
  const count = minPhotos === maxPhotos ? `建议 ${minPhotos} 张` : `建议 ${minPhotos}–${maxPhotos} 张`
  return hint ? `${count}，${hint}` : count
}
