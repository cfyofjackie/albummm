// PROTOTYPE — V3 背景结构母板。
// 问题：强对比但克制的背景，能否让一组 carousel 像一个连续作品？
// 入口：?prototype=carousel-smart&backgrounds=masters&background=night|field|edge|ink-wave|veil-flow
// 这层只提供纸面变量和背景层标识；绝不参与分页、卡片尺寸或碰撞计算。

// 这两张是用户为 V3 背景实验挑出的参考。它们不参与照片内容，也不跟着
// 某一张用户照片裁切；每一页各自以完整输出分辨率渲染，只用页序控制取景位置。
import inkWaveReference from '../../../reference/background/the-cleveland-museum-of-art-uNPsv1S6BhM-unsplash.jpg'
import veilFlowReference from '../../../reference/background/pexels-diva-34062837.jpg'

const grain = encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#g)' opacity='.055'/></svg>")

export const BACKGROUND_MASTERS = [
  {
    id: 'night',
    label: '深墨展墙',
    note: '深墨底 + 白相纸：最强对比，背景只负责托住照片。',
    paper: {
      color: '#21211f',
      image: `url("data:image/svg+xml,${grain}")`,
      size: '200px 200px',
      blend: 'soft-light',
    },
    ink: 'rgba(245, 240, 229, .72)',
  },
  {
    id: 'field',
    label: '硬边色场',
    note: '跨第 2–3 页的主色场 + 尾部同色回声：用节奏，而非更多渐变，制造 editorial 张力。',
    paper: {
      color: '#efebe2',
      // 主色场约 1.6 页宽：5 页时从第 2 页延到第 3 页中段；6 页时同样跨第 2–3 页。
      // 74–81% 的低浓度回声在 6 页输出里落在倒数第二页，给整条带子一个收束提示。
      image: 'linear-gradient(90deg, #efebe2 0 20%, #743d3d 20% 47%, #efebe2 47% 74%, rgba(116, 61, 61, .55) 74% 81%, #efebe2 81% 100%)',
      size: '100% 100%',
      blend: 'normal',
    },
    ink: 'rgba(60, 52, 47, .7)',
  },
  {
    id: 'edge',
    label: '连续轨道',
    note: '浅纸底 + 每页左侧深色边栏：强化左右滑动时的连续感。',
    paper: {
      color: '#e7e0d4',
      image: `url("data:image/svg+xml,${grain}")`,
      size: '200px 200px',
      blend: 'soft-light',
    },
    ink: 'rgba(63, 57, 48, .7)',
    accent: '#282825',
  },
  {
    id: 'ink-wave',
    label: '墨线波纹',
    note: '暖白纸上的低对比版画波纹：每页独立输出，页序只让取景缓慢移动。',
    paper: {
      color: '#eee9df',
      image: `url("data:image/svg+xml,${grain}")`,
      size: '200px 200px',
      blend: 'soft-light',
    },
    ink: 'rgba(68, 53, 40, .7)',
    layer: {
      image: inkWaveReference,
      position: ['38% 50%', '46% 50%', '54% 50%', '62% 50%', '70% 50%'],
    },
  },
  {
    id: 'veil-flow',
    label: '柔纱流体',
    note: '蓝紫与桃色的半透明流体：每页各自保留清晰纹理，同时从左到右缓慢推进。',
    paper: {
      color: '#e9e2e2',
      image: `url("data:image/svg+xml,${grain}")`,
      size: '200px 200px',
      blend: 'soft-light',
    },
    ink: 'rgba(62, 55, 69, .7)',
    layer: {
      image: veilFlowReference,
      position: ['18% 50%', '33% 50%', '50% 50%', '67% 50%', '82% 50%'],
    },
  },
]

export function backgroundMasterFor(id) {
  return BACKGROUND_MASTERS.find((item) => item.id === id) ?? null
}
