// PROTOTYPE — V3 背景结构母板。
// 问题：强对比但克制的背景，能否让一组 carousel 像一个连续作品？
// 入口：?prototype=carousel-smart&backgrounds=masters&background=night|field|edge
// 这层只提供纸面变量和背景层标识；绝不参与分页、卡片尺寸或碰撞计算。

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
]

export function backgroundMasterFor(id) {
  return BACKGROUND_MASTERS.find((item) => item.id === id) ?? null
}
