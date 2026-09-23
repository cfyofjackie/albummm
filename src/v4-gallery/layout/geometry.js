// Shared geometry for every V4 layout.
//
// These have nothing to do with any one template: they are the physical rules of
// the board and the math the solver uses on every photo set. Keeping them here is
// what lets a new template be pure data.

import { MAX_RATIO, MIN_RATIO } from './ratioPolicy.js'

export const BOARD_WIDTH = 100
export const BOARD_HEIGHT = 125

// Layout coordinates are percentage points of the board's width. Converting a
// physical height back into the board's 4:5 coordinate space needs this factor,
// because CSS `top` / `height` percentages resolve against the board height.
export const FRAME_ASPECT = BOARD_WIDTH / BOARD_HEIGHT

// The usable proportion band. Declared in ./ratioPolicy.js beside the copy that
// explains it, and re-exported here so the solver and the UI cannot disagree about
// what "an accepted ratio" means.
export { MAX_RATIO, MIN_RATIO }

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function aspectOf(photo) {
  return photo.aspect || photo.width / photo.height
}

// Keep the photo's genuine ratio but fold unusable extremes back into the band.
// The original ratio is preserved alongside it so a crop can be reported.
export function normalizeAspect(aspect) {
  return {
    original: aspect,
    placed: clamp(aspect, MIN_RATIO, MAX_RATIO),
    clamped: aspect < MIN_RATIO || aspect > MAX_RATIO,
  }
}

// Small, deterministic PRNG. A seed must never be able to invent a different
// style, only to rearrange inside the current one, so everything random in the
// solver flows through this.
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

// Upload order must never decide the composition, and a seed must not be able to
// invent a different style. So the order is shuffled, then bucketed by ratio
// family: a seed can rearrange inside a family and still cannot turn a contact
// sheet into a scattered pile.
export function shuffle(items, random) {
  const shuffled = items.slice()
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Two ways to order the same photos. `mixed` keeps the ratios interleaved, which
// is what makes a staircase of different heights; `sorted` puts the big tiles
// down first, which packs tighter. Neither wins on every input, so the solver
// searches both and keeps the better block.
export function buildQueue(entries, random, mode = 'mixed') {
  const ordered = shuffle(entries.slice(), random)
  if (mode === 'sorted') return ordered.sort((a, b) => b.placed - a.placed)
  const buckets = new Map()
  for (const item of ordered) {
    const key = Math.round(item.placed / 0.12)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  }
  const queue = []
  let remaining = true
  while (remaining) {
    remaining = false
    for (const bucket of buckets.values()) {
      if (bucket.length) {
        queue.push(bucket.shift())
        remaining = true
      }
    }
  }
  return queue
}
