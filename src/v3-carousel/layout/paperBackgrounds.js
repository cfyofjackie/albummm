// PROTOTYPE — V3 的背景族：纸面背景是「风格内部的一组选择」，不是独立于风格的一套色卡。
//
// 三条设计规则（依据见 validation-log.md §11、§17、§18）：
//   1. 风格 = 一组同气质的背景（2–4 个）；背景不跨风格乱配，否则风格轴会被搅乱。
//   2. 纸感优先于花纹：底色 + 细颗粒（SVG 噪声，`stitchTiles='stitch'` 无缝）+ 折痕，而不是"只有网格"。
//   3. 颜色对比按**面积**分配：「背景不得抢戏」不再是一刀切，而是
//        大面积（底色 / 全幅渐变）—— 低饱和、不太暗；
//        小面积（网格线 / 色带 / 边线）—— 允许高饱和、允许很暗。
//      也就是参考图里那种「浅底 + 小块强色」，而不是「整幅高饱和」。
//
// 所有背景都是纯 CSS 值（data-URI 的 SVG 噪声 + 渐变），可平铺、零素材、零授权。

// 每个层工厂都返回「按图逐条对齐」的三元组（images / sizes / blends）。
// 这一点必须严格：一个层可能由两条渐变组成（网格 = 横线 + 竖线），如果 size / blend 少给一条，
// 后面的层就会整体错位（网格被当成 100% 铺满、颗粒拿不到 soft-light）——实测踩过。
const layer = (images, sizes, blends) => ({ images: [].concat(images), sizes: [].concat(sizes), blends: [].concat(blends) })

const compose = (layers) => ({
  image: layers.flatMap((item) => item.images).join(', '),
  size: layers.flatMap((item) => item.sizes).join(', '),
  blend: layers.flatMap((item) => item.blends).join(', '),
})

// 无缝颗粒：feTurbulence + stitchTiles='stitch' 让噪声瓦片自身可无缝拼接，
// 所以整条带子（以及逐页平移取景的导出画布）都不会出现接缝。
const noiseTile = ({ frequency = .9, octaves = 4, opacity = .05, size = 200, blend = 'soft-light' } = {}) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>`
    + `<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}' stitchTiles='stitch'/>`
    + `<feColorMatrix type='saturate' values='0'/></filter>`
    + `<rect width='${size}' height='${size}' filter='url(#g)' opacity='${opacity}'/></svg>`
  return layer(`url("data:image/svg+xml,${encodeURIComponent(svg)}")`, `${size}px ${size}px`, blend)
}

// 网格线（小面积，可以比底色重一点）
const gridLines = (size, stroke) => layer(
  [`linear-gradient(${stroke} 1px, transparent 1px)`, `linear-gradient(90deg, ${stroke} 1px, transparent 1px)`],
  [`${size}px ${size}px`, `${size}px ${size}px`],
  ['normal', 'normal'],
)

// 全幅色带（大面积渐变）：Muse 的 editorial 底色
const bandGradient = (...stops) => layer(`linear-gradient(90deg, ${stops.join(', ')})`, '100% 100%', 'normal')

// 折痕 / 压印（低频、极淡）：纸张的起伏感
const crease = (angle, stops) => layer(`linear-gradient(${angle}deg, ${stops.join(', ')})`, '100% 100%', 'normal')

// 小块强调（小面积强色）：参考图里那种「浅底 + 一小块很重的颜色」。
// 半径用绝对值 px，所以在 1080 的导出尺度下仍然只是一个小点，不会随页面变大。
const accentDot = (x, y, color, radius) => layer(
  `radial-gradient(circle at ${x}% ${y}%, ${color} 0 ${radius}px, transparent ${radius}px)`,
  '100% 100%',
  'normal',
)

// 面积分配的两条边界（实测极值见 validation-log.md §18）：
//   大面积（底色 / 全幅渐变）—— 只允许「纸色」：彩度低、不太暗；
//   小面积（网格线 / 条带 / 边线）—— 允许高饱和、允许很暗（参考图里那种小块强色）。
// 判据用**彩度 chroma = max−min 通道差**，不用 HSL 饱和度：HSL 会把浅奶油色判成高饱和
// （#f2e9d6 的 HSL 饱和度是 .52，但它其实是极淡的纸色），彩度对它只有 .11，判断更诚实。
export const PAPER_RULES = {
  large: { maxChroma: .22, minLightness: .45 },
  small: { maxChroma: .55, minLightness: .20 },
  maxGrainOpacity: .12,
}

const GRAIN_FINE = noiseTile({ frequency: .9, octaves: 4, opacity: .05, size: 200 })
const GRAIN_FIBER = noiseTile({ frequency: 1.6, octaves: 3, opacity: .045, size: 160 })

export const PAPER_BACKGROUNDS = {
  gallery: [
    {
      id: 'gallery-warm', label: '暖白纸', colors: ['#f4f2ec'], accents: ['rgba(73, 68, 59, .055)'],
      paper: { color: '#f4f2ec', ...compose([gridLines(18, 'rgba(73, 68, 59, .055)'), GRAIN_FINE]) },
    },
    {
      id: 'gallery-fog', label: '雾灰', colors: ['#e7e4dc'], accents: ['rgba(69, 66, 58, .05)'],
      paper: { color: '#e7e4dc', ...compose([gridLines(18, 'rgba(69, 66, 58, .05)'), GRAIN_FINE]) },
    },
    {
      id: 'gallery-cool', label: '冷白', colors: ['#eef0ee'], accents: ['rgba(66, 72, 70, .055)'],
      paper: { color: '#eef0ee', ...compose([gridLines(22, 'rgba(66, 72, 70, .055)'), GRAIN_FINE]) },
    },
    {
      // 泛黄纸：纸张材质方向的第一张，折痕 + 纤维噪声比其它几张更明显。
      id: 'gallery-aged', label: '泛黄纸', colors: ['#f2e9d6', '#e6dcc4'], accents: ['rgba(120, 100, 70, .06)'],
      paper: {
        color: '#f2e9d6',
        ...compose([
          GRAIN_FIBER,
          crease(115, ['rgba(255, 255, 255, .35)', 'rgba(196, 178, 142, .28) 38%', 'rgba(255, 255, 255, .22) 62%', 'rgba(186, 168, 132, .3)']),
        ]),
      },
    },
  ],
  muse: [
    {
      id: 'muse-cream', label: '奶油', colors: ['#ece4d8', '#d9cabd', '#ad9f88', '#e6ded2'], accents: [],
      paper: { color: '#d9cabd', ...compose([bandGradient('#ece4d8 0%', '#d9cabd 44%', '#ad9f88 74%', '#e6ded2 100%'), GRAIN_FINE]) },
    },
    {
      id: 'muse-rose', label: '灰粉', colors: ['#ece0db', '#d9c4be', '#a78c86', '#e5dad5'], accents: [],
      paper: { color: '#d9c4be', ...compose([bandGradient('#ece0db 0%', '#d9c4be 44%', '#a78c86 74%', '#e5dad5 100%'), GRAIN_FINE]) },
    },
    {
      id: 'muse-blue', label: '雾蓝', colors: ['#e2e8ea', '#c6cfd5', '#8b98a1', '#dde3e6'], accents: [],
      paper: { color: '#c6cfd5', ...compose([bandGradient('#e2e8ea 0%', '#c6cfd5 44%', '#8b98a1 74%', '#dde3e6 100%'), GRAIN_FINE]) },
    },
    {
      id: 'muse-sage', label: '鼠尾草', colors: ['#e6e9e0', '#cbd2c4', '#8f9c85', '#e1e5da'], accents: [],
      paper: { color: '#cbd2c4', ...compose([bandGradient('#e6e9e0 0%', '#cbd2c4 44%', '#8f9c85 74%', '#e1e5da 100%'), GRAIN_FINE]) },
    },
  ],
  weekend: [
    {
      id: 'weekend-kraft', label: '牛皮纸', colors: ['#d9cfc0'], accents: ['rgba(74, 71, 63, .16)', '#9c3a30'],
      paper: { color: '#d9cfc0', ...compose([accentDot(7, 95, '#9c3a30', 5), gridLines(13, 'rgba(74, 71, 63, .16)'), GRAIN_FIBER]) },
    },
    {
      id: 'weekend-sand', label: '米色', colors: ['#e3d9c8'], accents: ['rgba(88, 78, 60, .14)', '#a8632c'],
      paper: { color: '#e3d9c8', ...compose([accentDot(7, 95, '#a8632c', 5), gridLines(15, 'rgba(88, 78, 60, .14)'), GRAIN_FIBER]) },
    },
    {
      id: 'weekend-sage', label: '灰绿', colors: ['#cfd2cb'], accents: ['rgba(66, 70, 62, .15)', '#3f6b52'],
      paper: { color: '#cfd2cb', ...compose([accentDot(7, 95, '#3f6b52', 5), gridLines(13, 'rgba(66, 70, 62, .15)'), GRAIN_FIBER]) },
    },
  ],
}

export const backgroundsForStyle = (styleId) => PAPER_BACKGROUNDS[styleId] ?? PAPER_BACKGROUNDS.gallery

// 风格切换后，原来选的背景可能不属于新风格 —— 这时回落到该风格的第一个背景。
export function backgroundFor(styleId, backgroundId) {
  const list = backgroundsForStyle(styleId)
  return list.find((item) => item.id === backgroundId) ?? list[0]
}

// 颜色 → 彩度 / 明度 / HSL 饱和度 / 相对亮度（供规则校验与测试使用）。
// 支持 #rrggbb 与 rgba(r, g, b, a)：低透明度的小面积线条按实色参数判断。
export function colorStats(value) {
  let channels
  if (value.startsWith('#')) {
    channels = [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
  } else {
    const parts = value.match(/[\d.]+/g).map(Number)
    channels = parts.slice(0, 3).map((channel) => channel / 255)
  }
  const [r, g, b] = channels
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const saturation = max === min ? 0 : (max - min) / (lightness > .5 ? 2 - max - min : max + min)
  const linear = channels.map((channel) => (channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4))
  return {
    chroma: max - min,
    lightness,
    saturation,
    luminance: .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2],
  }
}
