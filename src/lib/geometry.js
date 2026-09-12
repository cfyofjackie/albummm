// 版式几何：把 layoutId 翻译成 4:5 页面内的百分比盒子。
// 坐标均为 0–100，相对页面去掉统一留白后的内容区（见 album.css 的 --pad）。
// 单图页的盒子贴着照片本身（留白留在页面层），多图页用固定区域 + object-fit: contain。

// 单图页版式规格：等比放入 w×h 的框（inner-area 百分比，contain），
// anchorY 决定垂直锚点——top/bottom 是 V0.5 新增的竖图留白节奏位。
const SINGLE_SPEC = {
  'single-center': { w: 0.7, h: 0.7 },
  'single-full': { w: 0.97, h: 0.97 },
  'single-small': { w: 0.52, h: 0.52 },
  'single-offset': { w: 0.64, h: 0.64 },
  'single-top': { w: 0.86, h: 0.8, anchorY: 'top' },
  'single-bottom': { w: 0.86, h: 0.8, anchorY: 'bottom' },
}

// 多图页固定区域（百分比）
const REGIONS = {
  'double-side': [
    { x: 0, y: 0, w: 47, h: 100 },
    { x: 53, y: 0, w: 47, h: 100 },
  ],
  'double-stack': [
    { x: 0, y: 0, w: 100, h: 47 },
    { x: 0, y: 53, w: 100, h: 47 },
  ],
  'double-dominant': [
    { x: 0, y: 0, w: 62, h: 100 },
    { x: 67, y: 28, w: 33, h: 44 },
  ],
  'triple-row': [
    { x: 0, y: 0, w: 100, h: 29 },
    { x: 0, y: 35.5, w: 100, h: 29 },
    { x: 0, y: 71, w: 100, h: 29 },
  ],
  'triple-dominant': [
    { x: 0, y: 0, w: 100, h: 56 },
    { x: 0, y: 64, w: 47, h: 36 },
    { x: 53, y: 64, w: 47, h: 36 },
  ],
}

// 等比放入 w×h 的框（contain），返回 {w, h}
function fitInBox(bw, bh, aspect) {
  let w = Math.min(bw, bh * aspect)
  let h = w / aspect
  return { w, h }
}

export function boxesForPage(page, photosById) {
  if (page.type !== 'single') {
    const regions = REGIONS[page.layoutId]
    if (!regions) return []
    return page.imageIds.map((photoId, i) => ({ photoId, ...regions[i] }))
  }

  const photo = photosById[page.imageIds[0]]
  if (!photo) return []
  const base = page.layoutId.replace(/-(left|right)$/, '')
  const spec = SINGLE_SPEC[base] ?? SINGLE_SPEC['single-center']
  const aspect = photo.width / photo.height
  // 等比放入 spec 框（contain）
  let w = Math.min(spec.w, spec.h * aspect)
  let h = w / aspect
  let x = (1 - w) / 2
  let y = (1 - h) / 2

  if (base === 'single-offset') {
    const edge = page.layoutId.endsWith('-left') ? 3 : 97 - w * 100
    x = edge / 100
  }
  if (spec.anchorY === 'top') y = 0
  if (spec.anchorY === 'bottom') y = 1 - h
  return [{ photoId: photo.id, x: x * 100, y: y * 100, w: w * 100, h: h * 100 }]
}
