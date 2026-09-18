// PROTOTYPE — V4 Gallery overview layout.
// The board establishes one quiet, outward-growing photo group. The algorithm
// only adapts its frames to real image ratios and makes bounded seed variations.

export const BOARD_WIDTH = 100
export const BOARD_HEIGHT = 125

// Layout coordinates use percentage points of the board's width. Converting a
// physical height back to the board's 4:5 coordinate space needs this factor.
const FRAME_ASPECT = BOARD_WIDTH / BOARD_HEIGHT
const SAFE_WIDTH = 86
const SAFE_HEIGHT = 86

const GROWTH_PLAN = [
  { role: 'main', shortSide: 35 },
  { role: 'secondary', shortSide: 19, parent: 0, side: 'right', align: .2 },
  { role: 'secondary', shortSide: 19, parent: 0, side: 'left', align: .72 },
  { role: 'detail', shortSide: 13, parent: 0, side: 'top', align: .18 },
  { role: 'detail', shortSide: 14, parent: 0, side: 'bottom', align: .65 },
  { role: 'detail', shortSide: 11, parent: 1, side: 'top', align: .68 },
  { role: 'detail', shortSide: 12, parent: 2, side: 'bottom', align: .2 },
  { role: 'detail', shortSide: 10, parent: 3, side: 'left', align: .66 },
  { role: 'detail', shortSide: 11, parent: 4, side: 'right', align: .24 },
  { role: 'detail', shortSide: 10, parent: 5, side: 'right', align: .42 },
]

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

function nativeFrame(photo, shortSide) {
  const aspect = aspectOf(photo)
  return aspect >= 1
    ? { width: shortSide * aspect, height: shortSide }
    : { width: shortSide, height: shortSide / aspect }
}

function attachFrame(parent, frame, plan, random) {
  const gap = 1 + (random() - .5) * .3
  const alignment = clamp(plan.align + (random() - .5) * .12, 0, 1)
  if (plan.side === 'right') {
    return { ...frame, x: parent.x + parent.width + gap, y: parent.y + (parent.height - frame.height) * alignment }
  }
  if (plan.side === 'left') {
    return { ...frame, x: parent.x - frame.width - gap, y: parent.y + (parent.height - frame.height) * alignment }
  }
  if (plan.side === 'bottom') {
    return { ...frame, x: parent.x + (parent.width - frame.width) * alignment, y: parent.y + parent.height + gap }
  }
  return { ...frame, x: parent.x + (parent.width - frame.width) * alignment, y: parent.y - frame.height - gap }
}

function physicalBounds(frames) {
  const left = Math.min(...frames.map((frame) => frame.x))
  const top = Math.min(...frames.map((frame) => frame.y))
  const right = Math.max(...frames.map((frame) => frame.x + frame.width))
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height))
  return { left, top, width: right - left, height: bottom - top }
}

// Start at the main image and attach every next frame to an existing edge.
// This is deliberately not freeform packing: the plan preserves hierarchy,
// whitespace, and a readable centre of gravity for every seed.
export function buildGalleryOverview(photos, seed = 'gallery-01') {
  const selected = photos.slice(0, GROWTH_PLAN.length)
  const random = seededRandom(seed)
  const frames = []
  selected.forEach((photo, index) => {
    const plan = GROWTH_PLAN[index]
    const frame = nativeFrame(photo, plan.shortSide)
    if (index === 0) {
      frames.push({ ...frame, x: 0, y: 0, photo, plan })
      return
    }
    frames.push({ ...attachFrame(frames[plan.parent], frame, plan, random), photo, plan })
  })
  if (!frames.length) return []

  const bounds = physicalBounds(frames)
  const scale = Math.min(SAFE_WIDTH / bounds.width, SAFE_HEIGHT / bounds.height, 1)
  const offsetX = (BOARD_WIDTH - bounds.width * scale) / 2
  const offsetY = (BOARD_WIDTH - bounds.height * scale) / 2

  return frames.map((frame, index) => ({
    photo: frame.photo,
    id: frame.photo.id,
    role: frame.plan.role,
    zIndex: index + 1,
    x: offsetX + (frame.x - bounds.left) * scale,
    y: (offsetY + (frame.y - bounds.top) * scale) / FRAME_ASPECT,
    width: frame.width * scale,
    height: frame.height * scale / FRAME_ASPECT,
  }))
}

export function obscurersFor(selected, layout) {
  return layout.filter((tile) => tile.zIndex > selected.zIndex && overlaps(tile, selected))
}

// The viewport, not the photo, moves. This keeps every image in the same
// collage coordinate system while bringing the selected frame closer.
export function focusCameraFor(tile) {
  const visualSize = Math.max(tile.width, tile.height * FRAME_ASPECT)
  const scale = clamp(68 / visualSize, 1.35, 2.6)
  const centerX = tile.x + tile.width / 2
  const centerY = tile.y + tile.height / 2
  return {
    scale,
    translateX: 50 - scale * centerX,
    // CSS translateY(%) is measured against the element's full 125-unit
    // height, unlike translateX(%) which is measured against its 100-unit width.
    translateY: (BOARD_HEIGHT / 2 - scale * centerY) / BOARD_HEIGHT * 100,
  }
}
