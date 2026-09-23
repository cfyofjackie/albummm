const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

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
