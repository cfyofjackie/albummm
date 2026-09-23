// V5 的第一个模板只解决一件事：十张照片按参考图的阅读节奏散开、交叠。
// 坐标为画布百分比；横向数值相对宽度，纵向数值相对高度。
export const BOARD_RATIO = 4 / 3
export const REQUIRED_PHOTO_COUNT = 10
export const FRAME_MODES = {
  none: { id: 'none', label: '无边框' },
  polaroid: { id: 'polaroid', label: '拍立得' },
}

export const ALLOWED_FORMATS = [
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '1:1', ratio: 1 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '2:3', ratio: 2 / 3 },
]

// 手机和相机实际输出的像素通常会有极小误差，所以接受相邻格式 4% 内的照片。
const FORMAT_TOLERANCE = 0.04

export function acceptedFormatFor(photo) {
  const ratio = photo.width / photo.height
  return ALLOWED_FORMATS.find((format) => Math.abs(Math.log(ratio / format.ratio)) <= FORMAT_TOLERANCE) || null
}

export function isAcceptedPhoto(photo) {
  return Boolean(acceptedFormatFor(photo))
}

// 每种比例构成都有独立骨架：不能让全竖图硬套进偏横向的参考模板。
// `preferredRatio` 只用来给照片匹配位置，不会改变任何一张图的原始比例。
const SLOT_SETS = {
  mixed: [
    { centerX: 17, centerY: 20, rotate: -11, z: 4, preferredRatio: .75 },
    { centerX: 40, centerY: 26, rotate: 7, z: 3, preferredRatio: 1.33 },
    { centerX: 79, centerY: 22, rotate: 8, z: 5, preferredRatio: .75 },
    { centerX: 75, centerY: 39, rotate: -6, z: 8, preferredRatio: .75 },
    { centerX: 21, centerY: 47, rotate: 1, z: 2, preferredRatio: 1.33 },
    { centerX: 42, centerY: 58, rotate: -2, z: 9, preferredRatio: 1.33 },
    { centerX: 62, centerY: 59, rotate: 5, z: 10, preferredRatio: 1.33 },
    { centerX: 19, centerY: 78, rotate: 8, z: 4, preferredRatio: .75 },
    { centerX: 54, centerY: 81, rotate: 8, z: 6, preferredRatio: 1 },
    { centerX: 80, centerY: 75, rotate: -5, z: 3, preferredRatio: .75 },
  ],
  // 三行紧凑簇：适合全竖图或竖图占多数时，避免中间被拉出大空洞。
  portrait: [
    { centerX: 18, centerY: 20, rotate: -7, z: 4, preferredRatio: .75 },
    { centerX: 50, centerY: 18, rotate: 3, z: 5, preferredRatio: .75 },
    { centerX: 82, centerY: 20, rotate: 7, z: 4, preferredRatio: .75 },
    { centerX: 14, centerY: 50, rotate: 4, z: 3, preferredRatio: .75 },
    { centerX: 38, centerY: 50, rotate: -3, z: 7, preferredRatio: .75 },
    { centerX: 62, centerY: 50, rotate: 3, z: 8, preferredRatio: .75 },
    { centerX: 86, centerY: 50, rotate: -4, z: 3, preferredRatio: .75 },
    { centerX: 18, centerY: 80, rotate: 6, z: 4, preferredRatio: .75 },
    { centerX: 50, centerY: 82, rotate: -4, z: 6, preferredRatio: .75 },
    { centerX: 82, centerY: 80, rotate: 5, z: 4, preferredRatio: .75 },
  ],
  // 横图偏多时由三条横向阅读带组织，接近参考图的密集感。
  landscape: [
    { centerX: 18, centerY: 18, rotate: -7, z: 4, preferredRatio: 1.33 },
    { centerX: 50, centerY: 18, rotate: 3, z: 5, preferredRatio: 1.33 },
    { centerX: 82, centerY: 18, rotate: 7, z: 4, preferredRatio: 1.33 },
    { centerX: 13, centerY: 49, rotate: 3, z: 3, preferredRatio: 1.33 },
    { centerX: 38, centerY: 49, rotate: -4, z: 7, preferredRatio: 1.33 },
    { centerX: 63, centerY: 49, rotate: 4, z: 8, preferredRatio: 1.33 },
    { centerX: 87, centerY: 49, rotate: -3, z: 3, preferredRatio: 1.33 },
    { centerX: 18, centerY: 80, rotate: 6, z: 4, preferredRatio: 1.33 },
    { centerX: 50, centerY: 82, rotate: -4, z: 6, preferredRatio: 1.33 },
    { centerX: 82, centerY: 80, rotate: 5, z: 4, preferredRatio: 1.33 },
  ],
  square: [
    { centerX: 18, centerY: 19, rotate: -6, z: 4, preferredRatio: 1 },
    { centerX: 50, centerY: 18, rotate: 3, z: 5, preferredRatio: 1 },
    { centerX: 82, centerY: 19, rotate: 6, z: 4, preferredRatio: 1 },
    { centerX: 14, centerY: 50, rotate: 3, z: 3, preferredRatio: 1 },
    { centerX: 38, centerY: 50, rotate: -4, z: 7, preferredRatio: 1 },
    { centerX: 62, centerY: 50, rotate: 4, z: 8, preferredRatio: 1 },
    { centerX: 86, centerY: 50, rotate: -3, z: 3, preferredRatio: 1 },
    { centerX: 18, centerY: 81, rotate: 6, z: 4, preferredRatio: 1 },
    { centerX: 50, centerY: 82, rotate: -4, z: 6, preferredRatio: 1 },
    { centerX: 82, centerY: 81, rotate: 5, z: 4, preferredRatio: 1 },
  ],
}

function orientationFor(photo) {
  const ratio = photo.width / photo.height
  if (ratio > 1.05) return 'landscape'
  if (ratio < .95) return 'portrait'
  return 'square'
}

export function selectLayoutProfile(photos) {
  const count = photos.reduce((totals, photo) => {
    totals[orientationFor(photo)] += 1
    return totals
  }, { landscape: 0, portrait: 0, square: 0 })
  if (count.portrait >= 7) return 'portrait'
  if (count.landscape >= 7) return 'landscape'
  if (count.square >= 7) return 'square'
  return 'mixed'
}

function assignPhotosToSlots(photos, slots) {
  const remaining = [...photos]
  return slots.map((slot) => {
    const target = slot.preferredRatio
    const bestIndex = remaining.reduce((best, photo, index) => {
      const distance = Math.abs(Math.log((photo.width / photo.height) / target))
      return distance < best.distance ? { index, distance } : best
    }, { index: 0, distance: Infinity }).index
    return { photo: remaining.splice(bestIndex, 1)[0], slot }
  })
}

// 每张图在物理画布上占相同面积。面积而非最长边一致，才能让横图和竖图看上去
// 份量接近。此处的单位是「画布宽度百分比的平方」，并非像素面积。
const TILE_PHYSICAL_AREA = 520
// 保留拍立得下边，但不让相纸边框反过来压缩照片内容。
const POLAROID_INSET = { side: 1.15, bottom: 3.45 }
const POLAROID_SCALES = [.96, .92, .88, .84, .8, .76, .72]

const rectArea = (rect) => rect.width * rect.height
const intersection = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

function rotatedBounds(rect, rotate) {
  const theta = Math.abs(rotate) * Math.PI / 180
  if (!theta) return rect
  const physicalHeight = rect.height / BOARD_RATIO
  const extraX = Math.max(0, (rect.width * (Math.cos(theta) - 1) + physicalHeight * Math.sin(theta)) / 2)
  const extraY = Math.max(0, (rect.width * Math.sin(theta) + physicalHeight * (Math.cos(theta) - 1)) / 2) * BOARD_RATIO
  return { x: rect.x - extraX, y: rect.y - extraY, width: rect.width + extraX * 2, height: rect.height + extraY * 2 }
}

// 计算原图在锚点附近的完整尺寸。图片比例始终等于原图比例；`height` 以画布
// 高度为单位，因此要经过横向 4:3 画布的换算。这是避免拉伸和悄悄裁切的唯一几何步骤。
function contentFor(photo, scale = 1) {
  const aspect = photo.width / photo.height
  // physical area = width * height / BOARD_RATIO = width² / aspect.
  // 因此横图会更宽、竖图会更高，但两者的实际占地完全相同。
  const width = Math.sqrt(TILE_PHYSICAL_AREA * scale * scale * aspect)
  const height = (width * BOARD_RATIO) / aspect
  return { width, height }
}

function cardAt(photo, slot, frameMode, scale = 1, offset = { x: 0, y: 0 }) {
  const contentSize = contentFor(photo, scale)
  const hasFrame = frameMode === FRAME_MODES.polaroid.id
  const side = hasFrame ? POLAROID_INSET.side : 0
  const top = side * BOARD_RATIO
  const bottom = hasFrame ? POLAROID_INSET.bottom * BOARD_RATIO : 0
  const width = contentSize.width + side * 2
  const height = contentSize.height + top + bottom
  const x = slot.centerX + offset.x - width / 2
  const y = slot.centerY + offset.y - height / 2
  return {
    x,
    y,
    width,
    height,
    content: { x: x + side, y: y + top, ...contentSize },
  }
}

function isWithinBoard(card, rotate) {
  const bounds = rotatedBounds(card, rotate)
  return bounds.x >= 1 && bounds.y >= 1 && bounds.x + bounds.width <= 99 && bounds.y + bounds.height <= 99
}

function candidateOffsets() {
  const offsets = [{ x: 0, y: 0 }]
  for (const distance of [3, 6, 9, 12, 15, 18, 21]) {
    offsets.push(
      { x: distance, y: 0 }, { x: -distance, y: 0 }, { x: 0, y: distance }, { x: 0, y: -distance },
      { x: distance, y: distance }, { x: -distance, y: distance }, { x: distance, y: -distance }, { x: -distance, y: -distance },
    )
  }
  return offsets
}

const CANDIDATE_OFFSETS = candidateOffsets()

// V3 的关键经验是把外框与内容区分开判定。V5 为了保持参考图的密度，允许极少量
// 照片边缘相叠，但不会让一张照片的大块内容被另一张吃掉；旋转造成的外扩也纳入判定。
function isSafeFramedCard(candidate, placed, rotate) {
  if (!isWithinBoard(candidate, rotate)) return false
  const contentSafety = rotatedBounds(candidate.content, rotate)
  return placed.every((other) => {
    const otherContentSafety = rotatedBounds(other.content, other.rotate)
    const contentOverlapRatio = intersection(contentSafety, otherContentSafety) / Math.min(rectArea(contentSafety), rectArea(otherContentSafety))
    if (contentOverlapRatio > .08) return false
    const overlapRatio = intersection(candidate, other) / Math.min(rectArea(candidate), rectArea(other))
    // 边框可以像参考图那样有明显相叠；内容区仍是硬性零碰撞。
    return overlapRatio <= .32
  })
}

function buildFramedLayout(assignments, profile) {
  // 边框会扩大每张外卡片；优先只做一次全局等比缩小，再在各自锚点附近寻找安全位置。
  // 不允许为了放下某一张图而单独改变它的比例或尺寸。
  for (const scale of POLAROID_SCALES) {
    const placed = []
    for (let index = 0; index < assignments.length; index += 1) {
      const { photo, slot } = assignments[index]
      const found = CANDIDATE_OFFSETS
        .map((offset) => cardAt(photo, slot, FRAME_MODES.polaroid.id, scale, offset))
        .find((candidate) => isSafeFramedCard(candidate, placed, slot.rotate))
      if (!found) break
      placed.push({ ...found, id: photo.id, photo, rotate: slot.rotate, z: slot.z, profile })
    }
    if (placed.length === assignments.length) return placed
  }

  // 所有允许比例都在候选缩放内可解；这个回退仅防止未来修改锚点时页面变空。
  return assignments.map(({ photo, slot }) => {
    return { ...cardAt(photo, slot, FRAME_MODES.polaroid.id, POLAROID_SCALES.at(-1)), id: photo.id, photo, rotate: slot.rotate, z: slot.z, profile }
  })
}

export function buildReferenceLayout(photos, frameMode = FRAME_MODES.none.id) {
  if (photos.length !== REQUIRED_PHOTO_COUNT) {
    throw new Error(`这个模板需要 ${REQUIRED_PHOTO_COUNT} 张照片。`)
  }
  const profile = selectLayoutProfile(photos)
  const assignments = assignPhotosToSlots(photos, SLOT_SETS[profile])
  if (frameMode === FRAME_MODES.polaroid.id) return buildFramedLayout(assignments, profile)
  return assignments.map(({ photo, slot }) => ({
    id: photo.id,
    photo,
    ...cardAt(photo, slot, FRAME_MODES.none.id),
    rotate: slot.rotate,
    z: slot.z,
    profile,
  }))
}
