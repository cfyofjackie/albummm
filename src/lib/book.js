// 书本模型：把线性页面序列装订成 leaf（张）。
// leaf 0 = 封面（独占）；中间内容页两两配对（奇数补空白页，印刷书惯例）；最后一个 leaf = 封底（独占）。
// 纯函数，无 DOM。

export const BLANK_PAGE = Object.freeze({ type: 'blank', layoutId: 'blank', imageIds: [] })

export function buildLeaves(pages) {
  if (!Array.isArray(pages) || pages.length < 2) {
    throw new Error('buildLeaves 至少需要封面和封底两页')
  }
  if (pages[0].type !== 'cover' || pages[pages.length - 1].type !== 'back') {
    throw new Error('buildLeaves 要求序列以 cover 开头、back 结尾')
  }
  const content = pages.slice(1, -1)
  const leaves = [[pages[0]]]
  for (let i = 0; i < content.length; i += 2) {
    leaves.push([content[i], content[i + 1] ?? BLANK_PAGE])
  }
  leaves.push([pages[pages.length - 1]])
  return leaves
}

// leaf 在 spread 中的左右页对应的扁平页面索引（用于 Focus View 定位）。
// 空白页不参与：它没有照片，调用方不会对其发起 Focus。
export function flatIndexOf(leaves, leafIndex, side, totalPages) {
  if (leafIndex === 0) return side === 'right' ? 0 : null
  if (leafIndex === leaves.length - 1) return side === 'left' ? totalPages - 1 : null
  const base = 1 + (leafIndex - 1) * 2
  return side === 'left' ? base : base + 1
}
