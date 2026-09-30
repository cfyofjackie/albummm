import { OCCLUDER_ALPHA, OCCLUDER_EDGE_FRACTION, exportTransformFor, findOccluders } from './focusGeometry.js'

const BOARD_ASPECT = 4 / 3

// 导出档位：「日常保存 / 高清留存」两个可理解的选项，无损 PNG 保留为归档选项而非默认。
// JPEG 质量先用经验值；最终默认档以真机上的实际体积 + 100% 查看观感校准
// （docs/next-optimization-review.md §G），不预先承诺固定 MB 数。
export const EXPORT_TIERS = [
  { id: 'daily', label: '日常保存', note: '1600×1200 JPG · 体积小，适合分享', width: 1600, height: 1200, mime: 'image/jpeg', quality: .85, ext: 'jpg' },
  { id: 'hifi', label: '高清留存', note: '2400×1800 JPG · 细节更完整', width: 2400, height: 1800, mime: 'image/jpeg', quality: .92, ext: 'jpg' },
  { id: 'lossless', label: '无损 PNG', note: '2400×1800 PNG · 无损归档', width: 2400, height: 1800, mime: 'image/png', quality: undefined, ext: 'png' },
]

export function exportTiersFor(boardRatio = BOARD_ASPECT) {
  if (boardRatio === BOARD_ASPECT) return EXPORT_TIERS
  return EXPORT_TIERS.map((tier) => {
    const width = tier.id === 'daily' ? 1200 : 1800
    const height = tier.id === 'daily' ? 1600 : 2400
    return { ...tier, width, height, note: tier.note.replace(/\d+×\d+/, `${width}×${height}`) }
  })
}

const PATHS = {
  spark: 'M21 3v12M21 27v12M3 21h12M27 21h12M8 8l7 7m12 12 7 7m0-26-7 7M15 27 8 34',
  heart: 'M21 34C-2 21 9 4 21 15 33 4 44 21 21 34Z',
  loop: 'M5 56c16-29 36-36 52-23 19 15-11 37-19 10-7-24 32-38 54-16 21 21-12 39-22 13-8-20 26-39 49-22 22 16 1 40-18 21-13-12 15-37 40-18 14 10 14 24 31 29',
  cat: 'm25 37 8-22 16 14a42 42 0 0 1 22 0l16-14 8 22v25c0 19-15 29-35 29S25 81 25 62Z M45 56h1m29 0h1M54 70c4 4 8 4 12 0m-6-8v6m-8 0h16M25 61 6 54m19 15L5 73m90-12 19-7m-19 15 20 4',
  dog: 'M33 33C14 28 11 48 25 59c-5 26 14 33 35 33s40-7 35-33c14-11 11-31-8-26L78 43H42Z M46 56h1m27 0h1M54 67c4 5 8 5 12 0m-6-8v6m-9 0h18M34 83c-11 2-17 6-21 11m73-11c11 2 17 6 21 11',
  flowerStem: 'M50 54v48m0-21c-13-1-21-8-25-18m25 27c13-1 21-8 25-18',
  flowerHead: 'M50 56c-16 4-27-10-17-20-10-10 2-24 17-14 4-16 20-16 24 0 15-10 27 4 17 14 10 10-1 24-17 20Z',
  camera: 'M13 29h94v48H13Z M39 29l8-11h26l8 11M13 43h20m54 0h20M60 44v18m-9-9h18',
  clip: 'M16 4C8 4 4 10 4 18v34c0 16 24 16 24 0V22c0-9-14-9-14 0v28c0 4 6 4 6 0V25',
}

function loadImage(source, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(null); return }
    const image = new Image()
    let finished = false
    const finish = (value) => {
      if (finished) return
      finished = true
      signal?.removeEventListener('abort', abort)
      resolve(value)
    }
    const abort = () => {
      image.onload = null
      image.onerror = null
      image.src = ''
      finish(null)
    }
    signal?.addEventListener('abort', abort, { once: true })
    // 非 abort 的瞬时失败（内存压力下的解码/加载抖动）自动重试一次；
    // 仍失败才返回 null，由调用方决定中断还是降级。
    image.onload = () => finish(image)
    image.onerror = () => {
      if (!signal?.aborted && !image.dataset.retried) {
        image.dataset.retried = '1'
        window.setTimeout(() => { image.src = source }, 250)
        return
      }
      finish(null)
    }
    image.src = source
  })
}

async function drawBackground(ctx, background, width, height, signal) {
  ctx.fillStyle = background?.color || '#e6e5e0'
  ctx.fillRect(0, 0, width, height)
  if (!background?.image) return
  const image = await loadImage(background.image, signal)
  if (!image || signal?.aborted) return
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
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

function drawAutoDecoration(ctx, placement, backgroundColor) {
  const { id, x, y, width, height, rotate } = placement
  ctx.save()
  ctx.strokeStyle = '#252522'
  ctx.fillStyle = backgroundColor
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

// 手账文字的 DOM 字号用 cqw（拼贴链上没有容器查询，回退为视口宽）加 clamp；
// canvas 里按同一公式换算成「占画板宽度的百分比」，boardDisplayWidth 是画板在
// 页面上的 CSS 宽度——快照与放大层传入真实板宽，保证与拼贴页 DOM 渲染一致。
function handwriteFontSize(boardDisplayWidth) {
  const fontPx = Math.min(18, Math.max(10, window.innerWidth * .018))
  return fontPx / (boardDisplayWidth || Math.min(620, window.innerWidth)) * 100
}

function drawHandwrite(ctx, boardDisplayWidth) {
  // 与 .v5-collage__handwrite--top 对齐：top 7% left 43%，rotate(-4deg) 绕文本盒中心。
  const fontSize = handwriteFontSize(boardDisplayWidth)
  ctx.save()
  ctx.font = `700 ${fontSize}px "Segoe Print", "Comic Sans MS", cursive`
  ctx.textBaseline = 'middle'
  const textWidth = ctx.measureText('little things').width
  ctx.translate(43 + textWidth / 2, 7 + fontSize / 2)
  ctx.rotate(-4 * Math.PI / 180)
  ctx.fillText('little things', -textWidth / 2, 0)
  ctx.restore()
}

function drawMiniNote(ctx, boardDisplayWidth) {
  // 与 .v5-collage__mini-note 对齐：字号 clamp(13px, 2.7cqw, 27px)，bottom 8% left 4%，
  // rotate(14deg) 绕盒中心，字体继承 body 的 Helvetica/PingFang 栈。
  const fontPx = Math.min(27, Math.max(13, window.innerWidth * .027))
  const fontSize = fontPx / (boardDisplayWidth || Math.min(620, window.innerWidth)) * 100
  ctx.save()
  ctx.font = `${fontSize}px "Helvetica Neue", Helvetica, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const textWidth = ctx.measureText('✦').width
  ctx.translate(4 + textWidth / 2, 92 - fontSize * .58)
  ctx.rotate(14 * Math.PI / 180)
  ctx.fillText('✦', 0, 0)
  ctx.restore()
}

function drawBoardDecorations(ctx, enabled, placements, boardRatio, backgroundColor, boardDisplayWidth) {
  if (!enabled) return
  ctx.save()
  ctx.strokeStyle = '#252522'
  ctx.fillStyle = '#252522'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  drawPathBox(ctx, PATHS.spark, { x: 5, y: 5, width: 4.2, height: 4.2 * boardRatio, viewWidth: 42, viewHeight: 42, rotate: -12, lineWidth: 2.2 })
  drawPathBox(ctx, PATHS.heart, { x: 91.5, y: 8, width: 3.5, height: 3.5 * boardRatio, viewWidth: 42, viewHeight: 42, rotate: 12, lineWidth: 2.2 })
  // loop 的 CSS 高度由 viewBox 比例（180:78）从宽度推出；右 4%、底 6% 不变。
  const loopHeight = 17 * (78 / 180) * boardRatio
  drawPathBox(ctx, PATHS.loop, { x: 79, y: 94 - loopHeight, width: 17, height: loopHeight, viewWidth: 180, viewHeight: 78, rotate: -7, lineWidth: 1.6 })
  drawHandwrite(ctx, boardDisplayWidth)
  drawMiniNote(ctx, boardDisplayWidth)
  placements.forEach((placement) => drawAutoDecoration(ctx, placement, backgroundColor))
  ctx.restore()
}

// 卡片装饰（washi 胶带、回形针）的 canvas 绘制与 .v5-collage__washi / .v5-collage__clip
// 的 CSS 几何逐项对齐：拼贴页 DOM、整板快照、放大高清层与导出图四处所见一致。
// drawTile 已把原点平移到卡片中心并按卡片旋转，这里全部坐标相对卡片中心。
function drawCardDecoration(ctx, index, width, height) {
  if (index === 0 || index === 6) {
    // washi--0: top -3% left 28% rotate(-4deg)；washi--6: top -2% right 12% rotate(5deg)
    const top = index === 0 ? -.03 : -.02
    const left = index === 0 ? .28 : 1 - .12 - .48
    const tapeWidth = width * .48
    const tapeHeight = height * .1
    const rotate = index === 0 ? -4 : 5
    ctx.save()
    ctx.translate((left - .5 + .24) * width, (top - .5 + .05) * height)
    ctx.rotate(rotate * Math.PI / 180)
    const halfWidth = tapeWidth / 2
    const halfHeight = tapeHeight / 2
    // 与 clip-path: polygon(0 9%, 100% 0, 97% 94%, 2% 100%) 相同的撕边四角
    const tape = new Path2D()
    tape.moveTo(-halfWidth, -halfHeight + tapeHeight * .09)
    tape.lineTo(halfWidth, -halfHeight)
    tape.lineTo(halfWidth - tapeWidth * .03, halfHeight - tapeHeight * .06)
    tape.lineTo(-halfWidth + tapeWidth * .02, halfHeight)
    tape.closePath()
    // 与 linear-gradient(105deg, rgba(230,224,184,.88), rgba(194,183,128,.82)) 同走向
    const angle = 105 * Math.PI / 180
    const directionX = Math.sin(angle)
    const directionY = -Math.cos(angle)
    const gradientLength = tapeWidth * Math.abs(directionX) + tapeHeight * Math.abs(directionY)
    const gradient = ctx.createLinearGradient(-directionX * gradientLength / 2, -directionY * gradientLength / 2, directionX * gradientLength / 2, directionY * gradientLength / 2)
    gradient.addColorStop(0, 'rgba(230, 224, 184, .88)')
    gradient.addColorStop(1, 'rgba(194, 183, 128, .82)')
    ctx.fillStyle = gradient
    ctx.fill(tape)
    // 与 box-shadow: inset 0 0 0 1px rgba(255,255,255,.3) 近似的亮边
    ctx.strokeStyle = 'rgba(255, 255, 255, .3)'
    ctx.lineWidth = Math.max(1, tapeWidth * .006)
    ctx.stroke(tape)
    ctx.restore()
  }
  if (index === 1) {
    // clip: top -12% right 9% width 17% height 38% rotate(12deg)，viewBox 32×74 描边 2.4
    ctx.save()
    ctx.strokeStyle = '#5c5b58'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    drawPathBox(ctx, PATHS.clip, {
      x: (1 - .09 - .17 - .5) * width,
      y: (-.12 - .5) * height,
      width: width * .17, height: height * .38,
      viewWidth: 32, viewHeight: 74, rotate: 12, lineWidth: 2.4,
    })
    ctx.restore()
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

// 镜头移动时只缩放这一张已排好的预览图，避免 Safari 同时重绘十张旋转照片。
// 选中照片由同步高清 DOM 层全程补清，整板快照按 groupSafeScale 预留清晰度。
export async function renderBoardPreview({ layout, frameMode, decorationEnabled, autoPlacements, width, targetWidth, background }) {
  const images = new Map(await Promise.all(layout.map(async (tile) => [tile.id, await loadImage(tile.photo.previewSrc)])))
  if (images.size !== layout.length || [...images.values()].some((image) => !image)) return null
  // 放大动画期间用这张快照保持整板同步。以 3.4 倍为清晰度预算，
  // 边缘照片为覆盖导出框可能需要更高倍率；停稳后由可见区域画布补清晰度。
  // 宽度设 4096 上限约束内存（4096×3072 仍在 iOS 画布面积上限内）；
  // 选中照片则由常驻高清细节层全程补回。
  // 内容是照片，用 JPEG 编码更快、体积更小。
  const density = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  const boardRatio = layout[0]?.boardRatio || BOARD_ASPECT
  // 竖版同样限制画布总像素，避免 Safari 在 4096×5461 快照上耗尽内存。
  const maxWidth = Math.min(4096, Math.floor(Math.sqrt(16_000_000 * boardRatio)))
  canvas.width = targetWidth || Math.min(maxWidth, Math.max(1, Math.round(width * 3.4 * density)))
  canvas.height = Math.max(1, Math.round(canvas.width / boardRatio))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  await drawBackground(ctx, background, canvas.width, canvas.height)
  const unitX = canvas.width / 100
  const unitY = canvas.height / 100
  ctx.save(); ctx.scale(unitX, unitY); drawBoardDecorations(ctx, decorationEnabled, autoPlacements, boardRatio, background?.color || '#e6e5e0', width); ctx.restore()
  layout.map((tile, index) => ({ tile, index })).sort((a, b) => a.tile.z - b.tile.z || a.index - b.index)
    .forEach(({ tile, index }) => drawTile(ctx, tile, index, frameMode, images.get(tile.id), unitX, unitY, 0, 0, decorationEnabled))
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
}

// 选中照片的旋转矩形轮廓（输出坐标），作为导出时幽灵层的裁剪范围。
function tileOutlinePath(tile, transform) {
  const centerX = transform.originX + (tile.x + tile.width / 2) * transform.unitX
  const centerY = transform.originY + (tile.y + tile.height / 2) * transform.unitY
  const halfW = tile.width * transform.unitX / 2
  const halfH = tile.height * transform.unitY / 2
  const rad = tile.rotate * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const path = new Path2D()
  ;[[-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH]].forEach(([dx, dy], index) => {
    const x = centerX + dx * cos - dy * sin
    const y = centerY + dx * sin + dy * cos
    index === 0 ? path.moveTo(x, y) : path.lineTo(x, y)
  })
  path.closePath()
  return path
}

export async function exportFocusImage({ layout, selectedId, frameMode, decorationEnabled, autoPlacements, boardRect, frame, camera, tier = EXPORT_TIERS[1], background }) {
  // 与放大查看层的屏幕显示共用同一个场景渲染器，所见即所得。
  const canvas = await renderFocusScene({ layout, selectedId, frameMode, decorationEnabled, autoPlacements, boardRect, frame, camera, background, width: tier.width, height: tier.height, useOriginal: true })
  return new Promise((resolve) => canvas.toBlob(resolve, tier.mime, tier.quality))
}

// 场景渲染器（唯一实现）：背景 + 画布装饰 + 全部照片（z 序）+ 选中照片盖回 +
// 遮挡者半透明柔边。放大查看层的屏幕显示与导出文件共用这一份绘制，
// 「所见即所得」由构造保证。照片加载失败时抛错，由调用方决定提示或降级。
// useOriginal=false 用 1600px 预览图（屏幕显示足够且快），导出走原图。
export async function renderFocusScene({ layout, selectedId, frameMode, decorationEnabled, autoPlacements, boardRect, frame, camera, background, width, height, signal, useOriginal = true }) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background?.color || '#e6e5e0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const boardRatio = layout[0]?.boardRatio || BOARD_ASPECT
  const { originX, originY, unitX, unitY } = exportTransformFor(boardRect, frame, camera, { width: canvas.width, height: canvas.height })
  ctx.save()
  ctx.beginPath(); ctx.rect(originX, originY, unitX * 100, unitY * 100); ctx.clip()
  ctx.translate(originX, originY)
  await drawBackground(ctx, background?.focusImage ? { ...background, image: background.focusImage } : background, unitX * 100, unitY * 100)
  ctx.restore()
  if (signal?.aborted) return null
  ctx.save(); ctx.translate(originX, originY); ctx.scale(unitX, unitY); drawBoardDecorations(ctx, decorationEnabled, autoPlacements, boardRatio, background?.color || '#e6e5e0', boardRect.width); ctx.restore()
  const images = new Map(await Promise.all(layout.map(async (tile) => [tile.id, await loadImage(useOriginal ? (tile.photo.originalSrc || tile.photo.previewSrc) : tile.photo.previewSrc, signal)])))
  // 有照片加载失败就中断导出——宁可报错重试，也不能导出缺照片的白图。
  if (layout.some((tile) => !images.get(tile.id))) throw new Error('部分照片加载失败，请重试')
  layout.map((tile, index) => ({ tile, index })).sort((a, b) => a.tile.z - b.tile.z || a.index - b.index).forEach(({ tile, index }) => drawTile(ctx, tile, index, frameMode, images.get(tile.id), unitX, unitY, originX, originY, decorationEnabled))
  if (signal?.aborted) return null
  // 选中照片完整盖回原拼贴，再在相交范围内重画半透明遮挡者。
  const selectedTile = selectedId ? layout.find((tile) => tile.id === selectedId) : null
  if (selectedTile) {
    drawTile(ctx, selectedTile, layout.indexOf(selectedTile), frameMode, images.get(selectedTile.id), unitX, unitY, originX, originY, decorationEnabled)
    const occluders = findOccluders(layout, selectedTile)
    if (!occluders.length) return canvas
    const outline = tileOutlinePath(selectedTile, { originX, originY, unitX, unitY })
    const edgeCanvas = document.createElement('canvas')
    edgeCanvas.width = canvas.width
    edgeCanvas.height = canvas.height
    const edgeCtx = edgeCanvas.getContext('2d')
    occluders.forEach((tile) => {
      ctx.save()
      ctx.clip(outline)
      ctx.globalAlpha = OCCLUDER_ALPHA
      drawTile(ctx, tile, layout.indexOf(tile), frameMode, images.get(tile.id), unitX, unitY, originX, originY, decorationEnabled)
      ctx.restore()

      // 只给遮挡者的 alpha 加柔边，不模糊照片像素。
      edgeCtx.clearRect(0, 0, canvas.width, canvas.height)
      drawTile(edgeCtx, tile, layout.indexOf(tile), frameMode, images.get(tile.id), unitX, unitY, originX, originY, decorationEnabled)
      const edgeWidth = Math.min(tile.width * unitX, tile.height * unitY) * OCCLUDER_EDGE_FRACTION
      edgeCtx.save()
      edgeCtx.globalCompositeOperation = 'destination-in'
      edgeCtx.filter = `blur(${edgeWidth / 4}px)`
      edgeCtx.strokeStyle = '#fff'
      edgeCtx.lineWidth = edgeWidth
      edgeCtx.lineJoin = 'round'
      edgeCtx.stroke(outline)
      edgeCtx.restore()
      ctx.save()
      ctx.clip(outline)
      ctx.drawImage(edgeCanvas, 0, 0)
      ctx.restore()
    })
  }
  return canvas
}

export async function exportBoardImage({ layout, frameMode, decorationEnabled, autoPlacements, background, tier, boardDisplayWidth }) {
  const canvas = document.createElement('canvas')
  canvas.width = tier.width
  canvas.height = tier.height
  const ctx = canvas.getContext('2d')
  const boardRatio = layout[0]?.boardRatio || BOARD_ASPECT
  await drawBackground(ctx, background, canvas.width, canvas.height)
  const unitX = canvas.width / 100
  const unitY = canvas.height / 100
  ctx.save(); ctx.scale(unitX, unitY); drawBoardDecorations(ctx, decorationEnabled, autoPlacements, boardRatio, background?.color || '#e6e5e0', boardDisplayWidth); ctx.restore()
  // 用 1600px 预览图而非原图：导出画布里单张照片最大只占 ~1300px，预览已足够，
  // 而相机原图（5328×4000）逐张解码绘制在 Safari 上要数分钟且占内存巨大。
  const images = new Map(await Promise.all(layout.map(async (tile) => [tile.id, await loadImage(tile.photo.previewSrc)])))
  layout.map((tile, index) => ({ tile, index })).sort((a, b) => a.tile.z - b.tile.z || a.index - b.index)
    .forEach(({ tile, index }) => drawTile(ctx, tile, index, frameMode, images.get(tile.id), unitX, unitY, 0, 0, decorationEnabled))
  return new Promise((resolve) => canvas.toBlob(resolve, tier.mime, tier.quality))
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
