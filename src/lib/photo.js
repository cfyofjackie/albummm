let nextId = 0

export const MIN_PHOTOS = 5
export const MAX_PHOTOS = 20
export const RECOMMENDED = '8–12'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// 低分辨率预览的最长边：预览与翻页渲染足够，内存占用小
const PREVIEW_MAX_EDGE = 1600

export function classify(width, height) {
  const r = width / height
  if (r > 1.8) return 'ultra-wide'
  if (1 / r > 1.8) return 'ultra-tall'
  if (r > 1.05) return 'landscape'
  if (r < 0.95) return 'portrait'
  return 'square'
}

export function isAcceptedFile(file) {
  return ACCEPTED_TYPES.has(file.type)
}

// createImageBitmap 默认已按 EXIF 方向解码，读到的 width/height 即视觉方向
export async function loadPhoto(file) {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(width, height))
  const previewW = Math.round(width * scale)
  const previewH = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = previewW
  canvas.height = previewH
  canvas.getContext('2d').drawImage(bitmap, 0, 0, previewW, previewH)
  bitmap.close()

  const previewSrc = canvas.toDataURL('image/jpeg', 0.85)

  // 预解码：翻页/放大揭示这张图时不需要临时解码（避免空白页或延迟上屏）
  const im = new Image()
  im.src = previewSrc
  im.decode?.().catch(() => {})

  return {
    id: `p${++nextId}`,
    name: file.name,
    width,
    height,
    orientation: classify(width, height),
    previewSrc,
  }
}
