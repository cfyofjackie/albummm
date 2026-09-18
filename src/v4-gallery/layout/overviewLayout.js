// PROTOTYPE — V4 Gallery overview layout.
// The board owns hierarchy and quiet areas; this module only makes bounded,
// repeatable placement choices inside that editorial system.

export const BOARD_WIDTH = 100
export const BOARD_HEIGHT = 125

const ZONES = [
  { role: 'main', x: 26, y: 30, w: 55, h: 54, jitterX: 3, jitterY: 3, overlap: 0 },
  { role: 'secondary', x: 61, y: 10, w: 31, h: 30, jitterX: 5, jitterY: 4, overlap: 12 },
  { role: 'secondary', x: 7, y: 76, w: 33, h: 30, jitterX: 4, jitterY: 4, overlap: 8 },
  { role: 'detail', x: 5, y: 32, w: 25, h: 26, jitterX: 3, jitterY: 4, overlap: 3 },
  { role: 'detail', x: 67, y: 88, w: 27, h: 23, jitterX: 4, jitterY: 3, overlap: 2 },
  { role: 'detail', x: 82, y: 46, w: 14, h: 21, jitterX: 2, jitterY: 3, overlap: 2 },
  { role: 'detail', x: 38, y: 106, w: 30, h: 13, jitterX: 5, jitterY: 2, overlap: 2 },
  { role: 'detail', x: 4, y: 58, w: 21, h: 20, jitterX: 3, jitterY: 3, overlap: 5 },
  { role: 'detail', x: 38, y: 5, w: 22, h: 18, jitterX: 3, jitterY: 2, overlap: 2 },
  { role: 'detail', x: 80, y: 108, w: 14, h: 12, jitterX: 2, jitterY: 1, overlap: 2 },
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

function fitNativeFrame(photo, zone, scale = 1) {
  const aspect = aspectOf(photo)
  const width = Math.min(zone.w * scale, zone.h * aspect * scale)
  return { width, height: width / aspect }
}

function candidateFor(photo, zone, random, attempt) {
  const shrink = attempt > 8 ? .9 : attempt > 4 ? .96 : 1
  const { width, height } = fitNativeFrame(photo, zone, shrink)
  const xRange = Math.max(0, zone.w - width)
  const yRange = Math.max(0, zone.h - height)
  const nudgeX = (random() - .5) * zone.jitterX * 2
  const nudgeY = (random() - .5) * zone.jitterY * 2
  return {
    x: clamp(zone.x + xRange * random() + nudgeX, 3, BOARD_WIDTH - width - 3),
    y: clamp(zone.y + yRange * random() + nudgeY, 4, BOARD_HEIGHT - height - 4),
    width,
    height,
  }
}

function collisionScore(candidate, previous, allowedOverlap) {
  return previous.reduce((score, placed) => {
    const area = overlapArea(candidate, placed)
    if (!area) return score
    const smaller = Math.min(candidate.width * candidate.height, placed.width * placed.height)
    const ratio = area / smaller * 100
    return score + (ratio > allowedOverlap ? 10000 + ratio : ratio)
  }, 0)
}

// Each photo receives its native aspect-ratio frame.  The zones make the
// hierarchy stable while the seed moves frames only within their permitted area.
export function buildGalleryOverview(photos, seed = 'gallery-01') {
  const random = seededRandom(seed)
  return photos.slice(0, ZONES.length).map((photo, index, placed) => {
    const zone = ZONES[index]
    let winner
    let winnerScore = Infinity
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = candidateFor(photo, zone, random, attempt)
      const score = collisionScore(candidate, placed, zone.overlap) + attempt * .002
      if (score < winnerScore) {
        winner = candidate
        winnerScore = score
      }
    }
    return {
      ...winner,
      photo,
      id: photo.id,
      role: zone.role,
      zIndex: index + 1,
    }
  })
}

export function obscurersFor(selected, layout) {
  return layout.filter((tile) => tile.zIndex > selected.zIndex && overlaps(tile, selected))
}
