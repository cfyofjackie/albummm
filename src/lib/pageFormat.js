// 相册开本：整本书使用同一种页面比例，避免每页随照片比例变化而失去书本感。
// `pageRatio` / `spreadRatio` 供 CSS aspect-ratio 使用；`focusScale` 是 Focus View
// 在可用高度下换算页面宽度的比例（width / height）。

export const PAGE_FORMATS = [
  {
    id: 'portrait',
    name: '竖版摄影书',
    shortName: '3:4',
    desc: '推荐 · 适合手机竖拍与人像',
    pageRatio: '3 / 4',
    spreadRatio: '3 / 2',
    focusScale: 0.75,
    aspect: 3 / 4,
  },
  {
    id: 'landscape',
    name: '横版摄影书',
    shortName: '4:3',
    desc: '适合旅行、风景与横图',
    pageRatio: '4 / 3',
    spreadRatio: '8 / 3',
    focusScale: 4 / 3,
    aspect: 4 / 3,
  },
  {
    id: 'square',
    name: '方形摄影书',
    shortName: '1:1',
    desc: '适合比例混合的日常记录',
    pageRatio: '1 / 1',
    spreadRatio: '2 / 1',
    focusScale: 1,
    aspect: 1,
  },
  {
    id: 'editorial',
    name: 'Editorial',
    shortName: '4:5',
    desc: '杂志感 · 适合人像与精选图片',
    pageRatio: '4 / 5',
    spreadRatio: '8 / 5',
    focusScale: 0.8,
    aspect: 4 / 5,
  },
]

export const DEFAULT_PAGE_FORMAT = 'portrait'

export function getPageFormat(id = DEFAULT_PAGE_FORMAT) {
  return PAGE_FORMATS.find((format) => format.id === id) ?? PAGE_FORMATS[0]
}

// 「铺满」会不可避免裁切比例不一致的照片。仅当裁掉的面积不超过约 12% 时，
// 自动版式才允许使用满版；其他情况优先完整展示，后续再提供用户手动裁切。
export function isFullBleedCompatible(photo, formatId = DEFAULT_PAGE_FORMAT) {
  if (!photo?.width || !photo?.height) return false
  const pageAspect = getPageFormat(formatId).aspect
  const photoAspect = photo.width / photo.height
  const retained = Math.min(photoAspect / pageAspect, pageAspect / photoAspect)
  return 1 - retained <= 0.12
}

// 跨页画布的比例是单页的两倍宽。3:4 竖版书展开后恰好是 3:2，
// 因此特别适合承接相机常见的 3:2 横图作为跨页主视觉。
export function isSpreadBleedCompatible(photo, formatId = DEFAULT_PAGE_FORMAT) {
  if (!photo?.width || !photo?.height) return false
  const spreadAspect = getPageFormat(formatId).aspect * 2
  const photoAspect = photo.width / photo.height
  const retained = Math.min(photoAspect / spreadAspect, spreadAspect / photoAspect)
  return 1 - retained <= 0.12
}
