// 版式几何：把 layoutId 翻译成 4:5 页面内的百分比盒子。
// 坐标均为 0–100，相对页面去掉统一留白后的内容区（见 album.css 的 --pad）。
// 单图页的盒子贴着照片本身（留白留在页面层），多图页用固定区域 + object-fit: contain。

const SINGLE_SCALE = {
  'single-center': 0.7,
  'single-full': 0.97,
  'single-small': 0.52,
  'single-offset': 0.64,
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

// 等比缩放放入 scale×scale 的正方区域，返回居中盒（0–1）
function fitCentered(scale, aspect) {
  let w = scale
  let h = w / aspect
  if (h > scale) {
    h = scale
    w = scale * aspect
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
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
  const scale = SINGLE_SCALE[base] ?? 0.7
  const box = fitCentered(scale, photo.width / photo.height)

  if (base === 'single-offset') {
    const edge = page.layoutId.endsWith('-left') ? 3 : 97 - box.w * 100
    box.x = edge / 100
  }
  return [{ photoId: photo.id, x: box.x * 100, y: box.y * 100, w: box.w * 100, h: box.h * 100 }]
}
