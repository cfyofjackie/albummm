// PROTOTYPE — 第二档「风格专属排版装饰」。
// 问题：在不改变智能分页或照片几何的前提下，能否让 Muse / Weekend 更像
// 连续的 editorial 作品，而不是叠加贴纸？所有元素都留在页面外沿安全留白内。

const pad2 = (value) => String(value).padStart(2, '0')

function railPagesFor(pageCount) {
  if (pageCount <= 1) return [0]
  if (pageCount <= 3) return Array.from({ length: pageCount }, (_, index) => index)
  return [...new Set([0, Math.round((pageCount - 1) / 2), pageCount - 1])]
}

// 这些位置均在 placement 的卡片可用区（x ≥ 4%、y ≥ 11%）之外：
// 左 rail / 色带只使用 0–3.1% 页宽；Weekend 档案标记只使用顶部 0–7%。
// 因此它们是页级排版，不参与照片几何，也不会遮住照片内容。
export function styleDecorFor(styleId, index, total) {
  const page = pad2(index + 1)
  if (styleId === 'muse') {
    const active = railPagesFor(total).includes(index)
    return {
      kind: 'muse',
      rail: active ? `MUSE / ${page}` : null,
      band: active ? ['#b58378', '#788ea0', '#788d79'][index % 3] : null,
    }
  }
  if (styleId === 'weekend') {
    return {
      kind: 'weekend',
      // 当前图片读取不解析 EXIF；在有真实拍摄日期前，只用真实的页面序号，绝不伪造日期。
      archive: `FRAME ${page}`,
      accent: ['#b35a3d', '#7a8e69', '#b4984b'][index % 3],
    }
  }
  return { kind: 'gallery' }
}
