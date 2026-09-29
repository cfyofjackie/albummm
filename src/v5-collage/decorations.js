// 自动装饰只使用画布坐标：x 与画布宽度同单位，y 与画布高度同单位。
// 先把旋转相纸转换为保守的包围盒，再从剩余空白中放入小型线稿素材。

export const AUTO_DECORATION_ASSETS = [
  { id: 'cat', width: 12, height: 10, rotate: -7 },
  { id: 'dog', width: 12, height: 10, rotate: 6 },
  { id: 'flower', width: 10, height: 11, rotate: -4 },
  { id: 'camera', width: 12, height: 9, rotate: 4 },
]

const DEFAULT_BOARD_RATIO = 4 / 3
const EDGE_GUTTER = 2.5
const PHOTO_GUTTER = 1.2
const MAX_AUTO_DECORATIONS = 2

function rectAt(centerX, centerY, width, height) {
  return { x: centerX - width / 2, y: centerY - height / 2, width, height }
}

function overlap(a, b, gutter = 0) {
  return a.x - gutter < b.x + b.width
    && a.x + a.width + gutter > b.x
    && a.y - gutter < b.y + b.height
    && a.y + a.height + gutter > b.y
}

function withinBoard(rect) {
  return rect.x >= EDGE_GUTTER && rect.y >= EDGE_GUTTER
    && rect.x + rect.width <= 100 - EDGE_GUTTER
    && rect.y + rect.height <= 100 - EDGE_GUTTER
}

// 保守包围盒让装饰即使落在照片旋转后的角上，也不会与照片重叠。
export function rotatedBounds({ x, y, width, height, rotate = 0, boardRatio = DEFAULT_BOARD_RATIO }) {
  const theta = Math.abs(rotate) * Math.PI / 180
  if (!theta) return { x, y, width, height }
  const physicalHeight = height / boardRatio
  const extraX = (width * (Math.cos(theta) - 1) + physicalHeight * Math.sin(theta)) / 2
  const extraY = (width * Math.sin(theta) + physicalHeight * (Math.cos(theta) - 1)) / 2 * boardRatio
  return { x: x - extraX, y: y - extraY, width: width + extraX * 2, height: height + extraY * 2 }
}

function distanceBetweenRects(a, b, boardRatio) {
  const xGap = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0)
  const yGap = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0)
  return Math.hypot(xGap, yGap / boardRatio)
}

function seedFor(photos) {
  return photos.reduce((total, photo) => {
    const value = String(photo.id).split('').reduce((sum, character) => sum + character.charCodeAt(0), 0)
    return (total * 31 + value) >>> 0
  }, 17)
}

function candidateCenters() {
  const centers = []
  for (let y = 10; y <= 90; y += 4) {
    for (let x = 10; x <= 90; x += 4) centers.push({ x, y })
  }
  return centers
}

const CANDIDATE_CENTERS = candidateCenters()

function bestPlacement(asset, occupied, seed, excluded, boardRatio) {
  const candidates = CANDIDATE_CENTERS
    .map((center, index) => ({
      ...center,
      rect: rectAt(center.x, center.y, asset.width, asset.height),
      // 只用作同分时的稳定排序，页面刷新不会让素材跳位置。
      tieBreaker: (seed + index * 19) % 17,
    }))
    .map((candidate) => ({ ...candidate, safetyBounds: rotatedBounds({ ...candidate.rect, rotate: asset.rotate, boardRatio }) }))
    .filter((candidate) => withinBoard(candidate.safetyBounds))
    .filter((candidate) => !occupied.some((other) => overlap(candidate.safetyBounds, other, PHOTO_GUTTER)))
    .filter((candidate) => !excluded.some((other) => distanceBetweenRects(candidate.safetyBounds, other, boardRatio) < 8))
    .map((candidate) => ({
      ...candidate,
      clearance: Math.min(...occupied.map((other) => distanceBetweenRects(candidate.safetyBounds, other, boardRatio))),
    }))
    .sort((a, b) => b.clearance - a.clearance || a.tieBreaker - b.tieBreaker)
  return candidates[0] || null
}

export function buildAutoDecorationPlacements(layout, max = MAX_AUTO_DECORATIONS) {
  const boardRatio = layout[0]?.boardRatio || DEFAULT_BOARD_RATIO
  const occupied = layout.map(rotatedBounds)
  const seed = seedFor(layout.map((tile) => tile.photo))
  const placements = []
  const limit = Math.min(max, AUTO_DECORATION_ASSETS.length)
  const remainingAssets = [...AUTO_DECORATION_ASSETS]

  for (let index = 0; index < limit; index += 1) {
    let choice = null
    // 优先用正常尺寸；只有正常尺寸没有第二个安全空位时，才缩小到贴纸尺寸。
    for (const scale of [1, .82, .68]) {
      const options = remainingAssets
        .map((asset, assetIndex) => {
          const scaledAsset = { ...asset, width: asset.width * scale, height: asset.height * scale }
          return {
            asset: scaledAsset,
            assetIndex,
            candidate: bestPlacement(scaledAsset, occupied, seed + index * 11 + assetIndex, placements.map((placement) => placement.safetyBounds), boardRatio),
          }
        })
        .filter((option) => option.candidate)
        // 优先保留猫、狗这类角色型素材；同一素材的多个空位才比较留白大小。
        .sort((a, b) => a.assetIndex - b.assetIndex || b.candidate.clearance - a.candidate.clearance)
      if (options.length) {
        choice = options[0]
        break
      }
    }
    if (!choice) break
    const { asset, candidate } = choice
    const placement = { ...asset, x: candidate.rect.x, y: candidate.rect.y, rect: candidate.rect, safetyBounds: candidate.safetyBounds }
    placements.push(placement)
    occupied.push(candidate.safetyBounds)
    remainingAssets.splice(choice.assetIndex, 1)
  }
  return placements
}

export function rectanglesOverlap(a, b, gutter = 0) {
  return overlap(a, b, gutter)
}
