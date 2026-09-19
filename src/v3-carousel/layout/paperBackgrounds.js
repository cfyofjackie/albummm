// PROTOTYPE — V3 的背景族：纸面背景是「风格内部的一组选择」，不是独立于风格的一套色卡。
//
// 为什么这样分（产品和实测依据见 validation-log.md §11、§17）：
//   · 三种风格本身就是表层气质（direction.md §6），而实测显示 muse 与 weekend 剩下的差异主要就在背景；
//   · 如果背景能跨风格乱配，三种风格就不成立了（Gallery 配酒红大色块就不再是「安静相纸」）；
//   · 所以：**风格 = 一组同气质的背景（2–4 个）**，风格轴不动，背景只换 --paper-* 三个变量。
//
// 每个背景自带 `colors`（用到的实色），供「背景不得抢戏」的可测规则使用：
//   饱和度 ≤ .35、明度 ≥ .58、单个背景的亮度跨度 ≤ .45 —— 目的是拦住「高饱和大色块」和「深色背景」，
//   让照片始终是画面里对比最强的元素。低透明度的网格线不算实色，不参与校验。

const grid = (size, stroke) => ({
  image: `linear-gradient(${stroke} 1px, transparent 1px), linear-gradient(90deg, ${stroke} 1px, transparent 1px)`,
  size: `${size}px ${size}px`,
})

const band = (stops) => ({ image: `linear-gradient(90deg, ${stops})`, size: '100% 100%' })

export const PAPER_BACKGROUNDS = {
  gallery: [
    { id: 'gallery-warm', label: '暖白纸', colors: ['#f4f2ec'], paper: { color: '#f4f2ec', ...grid(18, 'rgba(73, 68, 59, .055)') } },
    { id: 'gallery-fog', label: '雾灰', colors: ['#e7e4dc'], paper: { color: '#e7e4dc', ...grid(18, 'rgba(69, 66, 58, .045)') } },
    { id: 'gallery-cool', label: '冷白', colors: ['#eef0ee'], paper: { color: '#eef0ee', ...grid(22, 'rgba(66, 72, 70, .05)') } },
  ],
  muse: [
    { id: 'muse-cream', label: '奶油', colors: ['#e5ddd2', '#d9cabd', '#b5aa97', '#dfd7cb'], paper: { color: '#d9cabd', ...band('#e5ddd2 0%, #d9cabd 46%, #b5aa97 72%, #dfd7cb 100%') } },
    { id: 'muse-rose', label: '灰粉', colors: ['#e6d8d3', '#d9c4be', '#ac928c', '#e0d3ce'], paper: { color: '#d9c4be', ...band('#e6d8d3 0%, #d9c4be 44%, #ac928c 74%, #e0d3ce 100%') } },
    { id: 'muse-blue', label: '雾蓝', colors: ['#dbe1e4', '#c6cfd5', '#93a0a8', '#d5dce0'], paper: { color: '#c6cfd5', ...band('#dbe1e4 0%, #c6cfd5 44%, #93a0a8 74%, #d5dce0 100%') } },
    { id: 'muse-sage', label: '鼠尾草', colors: ['#e0e3da', '#cbd2c4', '#98a48e', '#d8ddd2'], paper: { color: '#cbd2c4', ...band('#e0e3da 0%, #cbd2c4 44%, #98a48e 74%, #d8ddd2 100%') } },
  ],
  weekend: [
    { id: 'weekend-kraft', label: '牛皮纸', colors: ['#d9cfc0'], paper: { color: '#d9cfc0', ...grid(13, 'rgba(74, 71, 63, .08)') } },
    { id: 'weekend-sand', label: '米色', colors: ['#e3d9c8'], paper: { color: '#e3d9c8', ...grid(15, 'rgba(88, 78, 60, .07)') } },
    { id: 'weekend-sage', label: '灰绿', colors: ['#cfd2cb'], paper: { color: '#cfd2cb', ...grid(13, 'rgba(66, 70, 62, .075)') } },
  ],
}

// 「背景不得抢戏」的数值边界（由实测调参得出，见 validation-log.md §17）。
export const PAPER_RULES = { maxSaturation: .35, minLightness: .58, maxLuminanceSpan: .45 }

export const backgroundsForStyle = (styleId) => PAPER_BACKGROUNDS[styleId] ?? PAPER_BACKGROUNDS.gallery

// 风格切换后，原来选的背景可能不属于新风格 —— 这时回落到该风格的第一个背景。
export function backgroundFor(styleId, backgroundId) {
  const list = backgroundsForStyle(styleId)
  return list.find((item) => item.id === backgroundId) ?? list[0]
}

// 颜色 → HSL 饱和度 / 明度，以及相对亮度（供规则校验与测试使用）。
export function colorStats(hex) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
  const [r, g, b] = channels
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const saturation = max === min ? 0 : (max - min) / (lightness > .5 ? 2 - max - min : max + min)
  const linear = channels.map((value) => (value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4))
  return { saturation, lightness, luminance: .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2] }
}
