import { rectanglesOverlap, rotatedBounds } from './decorations.js'
import { BOARD_RATIO } from './layout.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// 选中照片的「玻璃化」遮挡者：相交区域内遮挡者的不透明度。
// 预览（DOM）与导出（canvas）共用这一个数值。
export const OCCLUDER_ALPHA = 0.3
export const OCCLUDER_EDGE_FRACTION = 0.03
const FOCUS_EDGE_BLEED = 2
const FOCUS_ZOOM_BOOST = 1.00

export function focusFrameFor(viewport, boardRatio = BOARD_RATIO) {
  // 四周留出可见的浅色边距，用户始终能辨认导出范围。
  const inset = Math.min(48, Math.max(20, Math.min(viewport.width, viewport.height) * .04))
  const width = Math.min(viewport.width - inset * 2, (viewport.height - inset * 2) * boardRatio)
  const height = width / boardRatio
  return { left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height }
}

// 单张照片的边缘安全倍率：画布盖住整个导出框的最低倍率。
// 镜头把照片中心放在导出框中心，因此最近的一边距决定了这个最低值；
// 多留 2px 防止边缘抗锯齿露底。
export function edgeScaleFor(tile, boardRect, frame) {
  const centerX = (tile.content.x + tile.content.width / 2) / 100 * boardRect.width
  const centerY = (tile.content.y + tile.content.height / 2) / 100 * boardRect.height
  const nearestHorizontalEdge = Math.min(centerX, boardRect.width - centerX)
  const nearestVerticalEdge = Math.min(centerY, boardRect.height - centerY)
  return Math.max(
    (frame.width / 2 + FOCUS_EDGE_BLEED) / nearestHorizontalEdge,
    (frame.height / 2 + FOCUS_EDGE_BLEED) / nearestVerticalEdge,
  )
}

// 整组统一倍率（方案 1）：全部照片共用同一个镜头倍率，镜头只平移不变倍，
// 切换照片时放大观感完全一致。取值 = 整组里最高的边缘安全倍率——
// 它保证任何一张照片居中取景时画布都盖得住导出框。
export function groupSafeScale(layout, boardRect, frame) {
  return layout.reduce((max, tile) => Math.max(max, edgeScaleFor(tile, boardRect, frame)), 0)
}

// 镜头倍率的三段拆解，供开发者调试页（#/dev/focus）展示：
// baseScale —— 以被选照片长边占导出框短边 78% 为目标，限幅 1.35–3.4；
// edgeScale —— 这张照片自己的边缘安全倍率；
// finalScale —— 实际使用的统一倍率；edges 为四边是否露出画布（true = 露出）。
export function focusScaleBreakdown(tile, boardRect, frame, finalScale) {
  const photoWidth = tile.content.width / 100 * boardRect.width
  const photoHeight = tile.content.height / 100 * boardRect.height
  const centerX = (tile.content.x + tile.content.width / 2) / 100 * boardRect.width
  const centerY = (tile.content.y + tile.content.height / 2) / 100 * boardRect.height
  const baseScale = clamp(Math.min(frame.width, frame.height) * .78 / Math.max(photoWidth, photoHeight), 1.35, 3.4)
  const covered = (distance, span) => finalScale * distance >= span / 2 + FOCUS_EDGE_BLEED
  return {
    baseScale,
    edgeScale: edgeScaleFor(tile, boardRect, frame),
    finalScale,
    centerX,
    centerY,
    edges: {
      left: !covered(centerX, frame.width),
      right: !covered(boardRect.width - centerX, frame.width),
      top: !covered(centerY, frame.height),
      bottom: !covered(boardRect.height - centerY, frame.height),
    },
  }
}

export function focusScaleFor(tile, boardRect, frame) {
  const breakdown = focusScaleBreakdown(tile, boardRect, frame, 0)
  return Math.max(breakdown.baseScale, breakdown.edgeScale) * FOCUS_ZOOM_BOOST
}

export function focusCameraFor(tile, boardRect, frame, scale) {
  const centerX = (tile.content.x + tile.content.width / 2) / 100 * boardRect.width
  const centerY = (tile.content.y + tile.content.height / 2) / 100 * boardRect.height
  return {
    scale,
    x: frame.left + frame.width / 2 - boardRect.left - centerX * scale,
    y: frame.top + frame.height / 2 - boardRect.top - centerY * scale,
  }
}

export function openingCamera() {
  // 全屏静止容器中的快照与普通画布使用同一组视口坐标。
  return { scale: 1, x: 0, y: 0 }
}

export function exportTransformFor(boardRect, frame, camera, output = { width: 2400, height: 1800 }) {
  const outputScaleX = output.width / frame.width
  const outputScaleY = output.height / frame.height
  return {
    originX: (boardRect.left + camera.x - frame.left) * outputScaleX,
    originY: (boardRect.top + camera.y - frame.top) * outputScaleY,
    unitX: boardRect.width / 100 * camera.scale * outputScaleX,
    unitY: boardRect.height / 100 * camera.scale * outputScaleY,
  }
}

// 高清层会把压在选中照片之上的邻居盖掉，破坏拼贴的真实遮挡关系。
// 幽灵层用来恢复它：在高清层之上再渲染遮挡者自己的高清拷贝，裁剪到
// 选中照片的矩形内并半透明——「看得出有东西盖着，也看得清盖住了什么」。
// 真正压在上面的邻居：z 序更高；z 相同时拼贴里靠后（DOM 更晚）的在上。
// 相交判定用包围盒近似：宁可多出一个裁剪后不可见的幽灵，也不漏判。
export function findOccluders(layout, selectedTile) {
  if (!selectedTile) return []
  const selectedIndex = layout.indexOf(selectedTile)
  return layout.filter((tile) => {
    if (tile.id === selectedTile.id) return false
    const above = tile.z > selectedTile.z || (tile.z === selectedTile.z && layout.indexOf(tile) > selectedIndex)
    return above && rectanglesOverlap(rotatedBounds(tile), rotatedBounds(selectedTile))
  }).sort((a, b) => a.z - b.z || layout.indexOf(a) - layout.indexOf(b))
}

// 先换算到物理画布坐标再旋转。横向 1% 与纵向 1% 在 4:3 画布上并不等长。
export function occluderClipPoints(selectedTile, ghostTile) {
  const boardRatio = selectedTile.boardRatio || BOARD_RATIO
  const halfW = selectedTile.width / 2
  const halfH = selectedTile.height / boardRatio / 2
  const selectedCenterX = selectedTile.x + halfW
  const selectedCenterY = (selectedTile.y + selectedTile.height / 2) / boardRatio
  const ghostCenterX = ghostTile.x + ghostTile.width / 2
  const ghostCenterY = (ghostTile.y + ghostTile.height / 2) / boardRatio
  const selectedRad = selectedTile.rotate * Math.PI / 180
  const inverseGhostRad = -ghostTile.rotate * Math.PI / 180
  const cosS = Math.cos(selectedRad)
  const sinS = Math.sin(selectedRad)
  const cosG = Math.cos(inverseGhostRad)
  const sinG = Math.sin(inverseGhostRad)
  const corners = [[-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH]]
  const points = corners.map(([dx, dy]) => {
    const px = selectedCenterX + dx * cosS - dy * sinS
    const py = selectedCenterY + dx * sinS + dy * cosS
    const rx = px - ghostCenterX
    const ry = py - ghostCenterY
    const localX = (rx * cosG - ry * sinG) / ghostTile.width * 100 + 50
    const localY = (rx * sinG + ry * cosG) / (ghostTile.height / boardRatio) * 100 + 50
    return [localX, localY]
  })
  return points
}

export function occluderClipPath(selectedTile, ghostTile) {
  const points = occluderClipPoints(selectedTile, ghostTile)
  return `polygon(${points.map(([x, y]) => `${Math.round(x * 100) / 100}% ${Math.round(y * 100) / 100}%`).join(', ')})`
}

// 遮挡者在选中照片的边缘保持接近原本的不透明度，向内逐渐降至 30%。
// SVG 只用于 alpha 蒙版，照片像素本身不会被模糊。
export function occluderMaskImage(selectedTile, ghostTile) {
  const points = occluderClipPoints(selectedTile, ghostTile).map(([x, y]) => `${x},${y}`).join(' ')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.75"/></filter></defs><polygon points="${points}" fill="white" fill-opacity="${OCCLUDER_ALPHA}"/><polygon points="${points}" fill="none" stroke="white" stroke-width="${OCCLUDER_EDGE_FRACTION * 100}" stroke-linejoin="round" filter="url(#soft)"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
