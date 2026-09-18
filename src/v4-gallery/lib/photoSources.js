// V4 owns its own photo pipeline: the overview is light, but a focused image
// must never be a re-encoded preview.

let nextId = 0
const OVERVIEW_MAX_EDGE = 1600

export function sourceForV4Photo(photo, isFocused) {
  return isFocused && photo.focusSrc ? photo.focusSrc : photo.previewSrc
}

export async function loadV4Photo(file) {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const scale = Math.min(1, OVERVIEW_MAX_EDGE / Math.max(width, height))
  const previewWidth = Math.round(width * scale)
  const previewHeight = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = previewWidth
  canvas.height = previewHeight
  canvas.getContext('2d').drawImage(bitmap, 0, 0, previewWidth, previewHeight)
  bitmap.close()

  return {
    id: `v4-p${++nextId}`,
    name: file.name,
    width,
    height,
    previewSrc: canvas.toDataURL('image/jpeg', 0.88),
    // This URL points directly at the user's original file. It is only used
    // for the current focus target, so the overview does not decode ten large
    // images at once.
    focusSrc: URL.createObjectURL(file),
  }
}

export function releaseV4PhotoSources(photos) {
  photos.forEach((photo) => {
    if (photo.focusSrc?.startsWith('blob:')) URL.revokeObjectURL(photo.focusSrc)
  })
}
