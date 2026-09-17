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

// Makes rows fill as much of the sheet as their native photo ratios allow.
// When a portrait-heavy set would overflow, the whole cluster becomes narrower;
// that is intentional: preserving the photo is more important than forcing a crop.
export function buildJustifiedCollage(photos) {
  if (!photos.length) return []
  const rows = []
  let cursor = 0
  for (const size of rowsFor(photos.length)) {
    const members = photos.slice(cursor, cursor + size)
    cursor += size
    if (members.length) rows.push(members)
  }

  const rawRows = rows.map((members) => {
    const usableWidth = SAFE_WIDTH - GAP * (members.length - 1)
    const aspectSum = members.reduce((sum, photo) => sum + (photo.aspect || .75), 0)
    return { members, height: usableWidth / aspectSum }
  })
  const totalRawHeight = rawRows.reduce((sum, row) => sum + row.height, 0) + GAP * (rawRows.length - 1)
  const scale = Math.min(1, SAFE_HEIGHT / totalRawHeight)
  const totalHeight = totalRawHeight * scale
  let y = (PAGE_HEIGHT - totalHeight) / 2
  const tiles = []

  for (const row of rawRows) {
    const height = row.height * scale
    const rowWidth = row.members.reduce((sum, photo) => sum + (photo.aspect || .75) * height, 0) + GAP * scale * (row.members.length - 1)
    let x = (100 - rowWidth) / 2
    for (const photo of row.members) {
      const width = (photo.aspect || .75) * height
      tiles.push({ photo, x, y, width, height, fit: 'contain' })
      x += width + GAP * scale
    }
    y += height + GAP * scale
  }
  return tiles
}

export const JUSTIFIED_PAGE_HEIGHT = PAGE_HEIGHT
