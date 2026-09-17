// Layout coordinates use a 3:4 page: 100 wide × 133.333 high.
const PAGE_HEIGHT = 133.333333
const SAFE_WIDTH = 84
const SAFE_HEIGHT = 108
const GAP = 1.35

function rowsFor(count) {
  if (count <= 3) return [count]
  if (count === 4) return [2, 2]
  if (count === 5) return [2, 3]
  if (count === 6) return [2, 2, 2]
  return [2, 3, count - 5]
}

function splitIntoRows(photos, sizes) {
  const rows = []
  let cursor = 0
  for (const size of sizes) {
    const members = photos.slice(cursor, cursor + size)
    cursor += size
    if (members.length) rows.push(members)
  }
  return rows
}

function aspectOf(photo) {
  return photo?.aspect || .75
}

function buildRows(photos, rowSizes, {
  widths = [],
  safeHeight = SAFE_HEIGHT,
  gap = GAP,
  aspectFor = aspectOf,
} = {}) {
  if (!photos.length) return []
  const rows = splitIntoRows(photos, rowSizes)
  const rawRows = rows.map((members, index) => {
    const targetWidth = widths[index] || SAFE_WIDTH
    const usableWidth = targetWidth - gap * (members.length - 1)
    const aspectSum = members.reduce((sum, photo) => sum + aspectFor(photo), 0)
    return { members, targetWidth, height: usableWidth / aspectSum }
  })
  const totalRawHeight = rawRows.reduce((sum, row) => sum + row.height, 0) + gap * (rawRows.length - 1)
  const scale = Math.min(1, safeHeight / totalRawHeight)
  const totalHeight = totalRawHeight * scale
  let y = (PAGE_HEIGHT - totalHeight) / 2
  const tiles = []

  for (const row of rawRows) {
    const height = row.height * scale
    const rowWidth = row.members.reduce((sum, photo) => sum + aspectFor(photo) * height, 0) + gap * scale * (row.members.length - 1)
    let x = (100 - rowWidth) / 2
    for (const photo of row.members) {
      const width = aspectFor(photo) * height
      tiles.push({ photo, x, y, width, height, fit: 'contain' })
      x += width + gap * scale
    }
    y += height + gap * scale
  }
  return tiles
}

// Makes rows fill as much of the sheet as their native photo ratios allow.
// When a portrait-heavy set would overflow, the whole cluster becomes narrower;
// that is intentional: preserving the photo is more important than forcing a crop.
export function buildJustifiedCollage(photos) {
  return buildRows(photos, rowsFor(photos.length))
}

// A narrow–wide–wide–narrow silhouette keeps the "growing outward" idea,
// while every tile still receives its real photo ratio instead of a fixed slot.
export function buildGrowingCollage(photos) {
  const count = Math.min(photos.length, 10)
  const selected = photos.slice(0, count)
  const shapes = count === 10 ? [2, 3, 3, 2] : rowsFor(count)
  const widths = shapes.length === 4 ? [64, 84, 84, 64] : shapes.map(() => SAFE_WIDTH)
  return buildRows(selected, shapes, { widths, safeHeight: 110 })
}

// The outer frame has 4% side borders plus a 16% lower margin.  Its ratio is
// derived from the actual picture window, so a landscape photo never gets
// quietly compressed into a portrait Polaroid (or vice versa).
export function polaroidAspect(photo) {
  const aspect = aspectOf(photo)
  return aspect / (.92 + .2 * aspect)
}

export function buildPolaroidWall(photos) {
  const count = Math.min(photos.length, 9)
  const selected = photos.slice(0, count)
  const rows = count === 9 ? [3, 3, 3] : rowsFor(count)
  return buildRows(selected, rows, {
    widths: rows.map(() => 76),
    safeHeight: 108,
    gap: 1.8,
    aspectFor: polaroidAspect,
  })
}

export function buildPolaroidStack(photos) {
  const anchors = [
    { x: 33, y: 31, width: 43, rotate: -3, zIndex: 2 },
    { x: 68, y: 33, width: 35, rotate: 3, zIndex: 3 },
    { x: 51, y: 58, width: 43, rotate: -1, zIndex: 4 },
    { x: 28, y: 88, width: 31, rotate: 2, zIndex: 1 },
    { x: 71, y: 86, width: 38, rotate: -2, zIndex: 3 },
    { x: 52, y: 108, width: 27, rotate: 2, zIndex: 5 },
  ]
  return photos.slice(0, anchors.length).map((photo, index) => {
    const anchor = anchors[index]
    const width = anchor.width
    const height = width / polaroidAspect(photo)
    return {
      photo,
      width,
      height,
      x: Math.max(3, Math.min(97 - width, anchor.x - width / 2)),
      y: Math.max(3, Math.min(PAGE_HEIGHT - height - 3, anchor.y - height / 2)),
      rotate: anchor.rotate,
      zIndex: anchor.zIndex,
      fit: 'contain',
    }
  })
}

export const JUSTIFIED_PAGE_HEIGHT = PAGE_HEIGHT
