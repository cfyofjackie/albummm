import { exportTransformFor } from './focusGeometry.js'

const OUTPUT_WIDTH = 2400
const OUTPUT_HEIGHT = 1800
const BOARD_ASPECT = 4 / 3

const PATHS = {
  spark: 'M21 3v12M21 27v12M3 21h12M27 21h12M8 8l7 7m12 12 7 7m0-26-7 7M15 27 8 34',
  heart: 'M21 34C-2 21 9 4 21 15 33 4 44 21 21 34Z',
  loop: 'M5 56c16-29 36-36 52-23 19 15-11 37-19 10-7-24 32-38 54-16 21 21-12 39-22 13-8-20 26-39 49-22 22 16 1 40-18 21-13-12 15-37 40-18 14 10 14 24 31 29',
  cat: 'm25 37 8-22 16 14a42 42 0 0 1 22 0l16-14 8 22v25c0 19-15 29-35 29S25 81 25 62Z M45 56h1m29 0h1M54 70c4 4 8 4 12 0m-6-8v6m-8 0h16M25 61 6 54m19 15L5 73m90-12 19-7m-19 15 20 4',
  dog: 'M33 33C14 28 11 48 25 59c-5 26 14 33 35 33s40-7 35-33c14-11 11-31-8-26L78 43H42Z M46 56h1m27 0h1M54 67c4 5 8 5 12 0m-6-8v6m-9 0h18M34 83c-11 2-17 6-21 11m73-11c11 2 17 6 21 11',
  flowerStem: 'M50 54v48m0-21c-13-1-21-8-25-18m25 27c13-1 21-8 25-18',
  flowerHead: 'M50 56c-16 4-27-10-17-20-10-10 2-24 17-14 4-16 20-16 24 0 15-10 27 4 17 14 10 10-1 24-17 20Z',
  camera: 'M13 29h94v48H13Z M39 29l8-11h26l8 11M13 43h20m54 0h20M60 44v18m-9-9h18',
}

function loadImage(source) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = source
  })
}

function strokePath(ctx, path) {
  ctx.stroke(new Path2D(path))
}

function drawPathBox(ctx, path, { x, y, width, height, viewWidth, viewHeight, rotate = 0, fill = false, lineWidth = 2.2 }) {
  ctx.save()
  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate(rotate * Math.PI / 180)
  ctx.scale(width / viewWidth, height / viewHeight)
  ctx.translate(-viewWidth / 2, -viewHeight / 2)
  ctx.lineWidth = lineWidth
  const shape = new Path2D(path)
  if (fill) ctx.fill(shape)
  ctx.stroke(shape)
  ctx.restore()
}

function drawAutoDecoration(ctx, placement) {
  const { id, x, y, width, height, rotate } = placement
  ctx.save()
  ctx.strokeStyle = '#252522'
  ctx.fillStyle = '#e6e5e0'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (id === 'flower') {
    drawPathBox(ctx, PATHS.flowerStem, { x, y, width, height, viewWidth: 100, viewHeight: 110, rotate, lineWidth: 3.2 })
    drawPathBox(ctx, PATHS.flowerHead, { x, y, width, height, viewWidth: 100, viewHeight: 110, rotate, fill: true, lineWidth: 3.2 })
    ctx.save()
    ctx.translate(x + width / 2, y + height / 2)
    ctx.rotate(rotate * Math.PI / 180)
    ctx.scale(width / 100, height / 110)
    ctx.beginPath(); ctx.arc(50, 40, 7, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
  } else if (id === 'cat') {
    drawPathBox(ctx, PATHS.cat, { x, y, width, height, viewWidth: 120, viewHeight: 100, rotate, fill: true, lineWidth: 3.2 })
  } else if (id === 'dog') {
    drawPathBox(ctx, PATHS.dog, { x, y, width, height, viewWidth: 120, viewHeight: 100, rotate, fill: true, lineWidth: 3.2 })
  } else {
    drawPathBox(ctx, PATHS.camera, { x, y, width, height, viewWidth: 120, viewHeight: 90, rotate, fill: true, lineWidth: 3.2 })
    ctx.save(); ctx.translate(x + width / 2, y + height / 2); ctx.rotate(rotate * Math.PI / 180); ctx.scale(width / 120, height / 90); ctx.beginPath(); ctx.arc(60, 53, 17, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  }
  ctx.restore()
}

function drawBoardDecorations(ctx, enabled, placements) {
  if (!enabled) return
  ctx.save()
  ctx.strokeStyle = '#252522'
  ctx.fillStyle = '#252522'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  drawPathBox(ctx, PATHS.spark, { x: 5, y: 5, width: 4.2, height: 4.2 * BOARD_ASPECT, viewWidth: 42, viewHeight: 42, rotate: -12, lineWidth: 2.2 })
  drawPathBox(ctx, PATHS.heart, { x: 91.5, y: 8, width: 3.5, height: 3.5 * BOARD_ASPECT, viewWidth: 42, viewHeight: 42, rotate: 12, lineWidth: 2.2 })
  drawPathBox(ctx, PATHS.loop, { x: 79, y: 87.07, width: 17, height: 6.93, viewWidth: 180, viewHeight: 78, rotate: -7, lineWidth: 1.6 })
  ctx.save(); ctx.font = '700 2px "Segoe Print", cursive'; ctx.translate(43, 7); ctx.rotate(-4 * Math.PI / 180); ctx.fillText('little things', 0, 0); ctx.restore()
  ctx.font = '3px sans-serif'; ctx.fillText('✦', 4, 92)
  placements.forEach((placement) => drawAutoDecoration(ctx, placement))
  ctx.restore()
}

function drawCardDecoration(ctx, index, width, height) {
  if (index === 0 || index === 6) {
    ctx.save(); ctx.translate(width * .04, -height * .53); ctx.rotate(index === 0 ? -.07 : .09); ctx.fillStyle = 'rgba(213, 202, 142, .88)'; ctx.fillRect(0, 0, width * .48, height * .1); ctx.restore()
  }
  if (index === 1) {
    ctx.save(); ctx.translate(width * .26, -height * .58); ctx.rotate(.2); ctx.strokeStyle = '#5c5b58'; ctx.lineWidth = .22; ctx.beginPath(); ctx.roundRect(-1.2, 0, 2.4, height * .42, 1.1); ctx.stroke(); ctx.restore()
  }
}

function drawTile(ctx, tile, index, frameMode, image, unitX, unitY, originX, originY, decorationEnabled) {
  const centerX = originX + (tile.x + tile.width / 2) * unitX
  const centerY = originY + (tile.y + tile.height / 2) * unitY
  const width = tile.width * unitX
  const height = tile.height * unitY
  const contentX = (tile.content.x - tile.x) * unitX - width / 2
  const contentY = (tile.content.y - tile.y) * unitY - height / 2
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(tile.rotate * Math.PI / 180)
  if (frameMode === 'polaroid') { ctx.fillStyle = '#fcfbf8'; ctx.fillRect(-width / 2, -height / 2, width, height) }
  if (image) ctx.drawImage(image, contentX, contentY, tile.content.width * unitX, tile.content.height * unitY)
  if (decorationEnabled) drawCardDecoration(ctx, index, width, height)
  ctx.restore()
}

export async function exportFocusPng({ layout, frameMode, decorationEnabled, autoPlacements, boardRect, frame, camera }) {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_WIDTH
  canvas.height = OUTPUT_HEIGHT
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#e6e5e0'
  ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
  const { originX, originY, unitX, unitY } = exportTransformFor(boardRect, frame, camera, { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT })
  ctx.save(); ctx.translate(originX, originY); ctx.scale(unitX, unitY); drawBoardDecorations(ctx, decorationEnabled, autoPlacements); ctx.restore()
  const images = new Map(await Promise.all(layout.map(async (tile) => [tile.id, await loadImage(tile.photo.originalSrc || tile.photo.previewSrc)])))
  layout.map((tile, index) => ({ tile, index })).sort((a, b) => a.tile.z - b.tile.z || a.index - b.index).forEach(({ tile, index }) => drawTile(ctx, tile, index, frameMode, images.get(tile.id), unitX, unitY, originX, originY, decorationEnabled))
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export function downloadBlob(blob, filename = 'v5-focus-collage.png') {
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
