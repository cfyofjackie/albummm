// PROTOTYPE — V4 Gallery overview layout.
// The board establishes one compact, band-built photo group. The algorithm
// only adapts its frames to real image ratios and makes bounded seed variations.

export const BOARD_WIDTH = 100
export const BOARD_HEIGHT = 125

// Layout coordinates use percentage points of the board's width. Converting a
// physical height back to the board's 4:5 coordinate space needs this factor.
const FRAME_ASPECT = BOARD_WIDTH / BOARD_HEIGHT
const SAFE_WIDTH = 76
const SAFE_HEIGHT = 78
const GUTTER = 1.25

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function aspectOf(photo) {
  return photo.aspect || photo.width / photo.height
}

export function seededRandom(seed) {
  let value = 2166136261
  for (const char of String(seed)) {
    value ^= char.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

export function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function overlapArea(a, b) {
  if (!overlaps(a, b)) return 0
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
}

export function intersectionOf(a, b) {
  if (!overlaps(a, b)) return null
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return {
    x,
    y,
    width: Math.min(a.x + a.width, b.x + b.width) - x,
    height: Math.min(a.y + a.height, b.y + b.height) - y,
  }
}

function roleFor(index) {
  if (index === 0) return 'main'
  if (index < 3) return 'secondary'
  return 'detail'
}

function photoRows(indices) {
  if (indices.length <= 3) return [indices]
  const rows = []
  let cursor = 0
  while (cursor < indices.length) {
    const remaining = indices.length - cursor
    const count = remaining === 4 ? 2 : Math.min(3, remaining)
    rows.push(indices.slice(cursor, cursor + count))
    cursor += count
  }
  return rows
}

function rowFrames(photos, indices, targetWidth, x, y) {
  const aspectTotal = indices.reduce((total, index) => total + aspectOf(photos[index]), 0)
  const height = (targetWidth - GUTTER * (indices.length - 1)) / aspectTotal
  let cursor = x
  return indices.map((index) => {
    const width = height * aspectOf(photos[index])
    const frame = { x: cursor, y, width, height, photo: photos[index], index, role: roleFor(index) }
    cursor += width + GUTTER
    return frame
  })
}

function physicalBounds(frames) {
  const left = Math.min(...frames.map((frame) => frame.x))
  const top = Math.min(...frames.map((frame) => frame.y))
  const right = Math.max(...frames.map((frame) => frame.x + frame.width))
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height))
  return { left, top, width: right - left, height: bottom - top }
}

// Tight justified photo bands create one continuous, irregular collage block.
// Each band's height is derived from the selected photos' real proportions, so
// there are no fixed-ratio boxes, crop windows, or masonry holes.
export function buildGalleryOverview(photos, seed = 'gallery-01') {
  const selected = photos.slice(0, 10)
  if (!selected.length) return []
  const random = seededRandom(seed)
  const frames = []
  const detailOrder = [3, 4, 5, 2, 1, 9, 6, 7, 8]
    .filter((index) => index < selected.length)
    .concat(selected.map((_, index) => index).filter((index) => index !== 0 && ![3, 4, 5, 2, 1, 9, 6, 7, 8].includes(index)))
  let y = 0
  photoRows(detailOrder).forEach((indices, rowIndex) => {
    const targetWidth = indices.length === 2 ? 56 : 68
    const baseInset = rowIndex % 3 === 1 ? 0 : rowIndex % 3 === 2 ? 8 : 10
    const x = baseInset + (random() - .5) * 2
    const row = rowFrames(selected, indices, targetWidth, x, y)
    frames.push(...row)
    y += row[0].height + GUTTER
  })
  const main = selected[0]
  const mainWidth = clamp(aspectOf(main) * 34, 31, 46)
  frames.push({
    x: 13 + (random() - .5) * 3,
    y,
    width: mainWidth,
    height: mainWidth / aspectOf(main),
    photo: main,
    index: 0,
    role: 'main',
  })

  const bounds = physicalBounds(frames)
  const scale = Math.min(SAFE_WIDTH / bounds.width, SAFE_HEIGHT / bounds.height, 1)
  const offsetX = (BOARD_WIDTH - bounds.width * scale) / 2
  const offsetY = (BOARD_WIDTH - bounds.height * scale) / 2

  return frames.map((frame) => ({
    photo: frame.photo,
    id: frame.photo.id,
    role: frame.role,
    zIndex: frame.index + 1,
    x: offsetX + (frame.x - bounds.left) * scale,
    y: (offsetY + (frame.y - bounds.top) * scale) * FRAME_ASPECT,
    width: frame.width * scale,
    height: frame.height * scale * FRAME_ASPECT,
  })).sort((a, b) => a.zIndex - b.zIndex)
}

export function obscurersFor(selected, layout) {
  return layout.filter((tile) => tile.zIndex > selected.zIndex && overlaps(tile, selected))
}

// The viewport, not the photo, moves. This keeps every image in the same
// collage coordinate system while bringing the selected frame closer.
export function focusCameraFor(tile) {
  const visualSize = Math.max(tile.width, tile.height / FRAME_ASPECT)
  const scale = clamp(68 / visualSize, 1.35, 2.6)
  const centerX = tile.x + tile.width / 2
  const centerY = tile.y + tile.height / 2
  return {
    scale,
    translateX: 50 - scale * centerX,
    translateY: 50 - scale * centerY,
  }
}
