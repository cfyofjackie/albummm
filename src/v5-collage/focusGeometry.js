import { rectanglesOverlap, rotatedBounds } from './decorations.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// 选中照片的「玻璃化」遮挡者：相交区域内遮挡者的不透明度。
// 预览（DOM）与导出（canvas）共用这一个数值。
export const OCCLUDER_ALPHA = 0.3

export function focusFrameFor(viewport) {
  const width = Math.min(viewport.width, viewport.height * 4 / 3)
  const height = width * 3 / 4
  return { left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height }
}

export function focusScaleFor(tile, boardRect, frame) {
  const photoWidth = tile.content.width / 100 * boardRect.width
  const photoHeight = tile.content.height / 100 * boardRect.height
  // 比上一版再提高约 24%，让被选照片成为明确主体，只留下少量周边关系。
  const desiredLongEdge = Math.min(frame.width, frame.height) * .78
  return clamp(desiredLongEdge / Math.max(photoWidth, photoHeight), 1.35, 3.4)
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
  })
}

// 幽灵层的裁剪形状：选中照片（含自身旋转）的四个角换算进幽灵层自己的
// 盒子坐标，用百分比表达——与镜头无关，所以从点击那一帧到动画结束
// 都是同一个值，不需要随动画重算。
export function occluderClipPath(selectedTile, ghostTile) {
  const halfW = selectedTile.width / 2
  const halfH = selectedTile.height / 2
  const selectedCenterX = selectedTile.x + halfW
  const selectedCenterY = selectedTile.y + halfH
  const ghostCenterX = ghostTile.x + ghostTile.width / 2
  const ghostCenterY = ghostTile.y + ghostTile.height / 2
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
    const localY = (rx * sinG + ry * cosG) / ghostTile.height * 100 + 50
    return `${Math.round(localX * 100) / 100}% ${Math.round(localY * 100) / 100}%`
  })
  return `polygon(${points.join(', ')})`
}
