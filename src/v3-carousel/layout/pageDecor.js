// PROTOTYPE — V3 排版层装饰：页脚条 + micro-label。
//
// 这一层是**用排版做装饰**，不是加贴纸。依据是对 reference/carousel 里 11 张参考图的清点
// （见 validation-log.md §20）：参考图里 90% 的装饰是「文字 + 细线 + 序号 + 色块」，
// 贴纸/胶带类几乎为零。所以这里只做三件事：
//   1. 页脚条：一条细线 + 左「01 / 05」+ 右一个极小的全大写标签
//   2. micro-label：一组作品里 2–4 处，贴在照片下方（**不压照片**，与胶带同一套「不遮内容」原则）
//   3. 细线：页脚细线 + micro-label 前的短刻度
//
// micro-label 会占位，所以它的矩形要并进碰撞安全盒（和胶带一样），
// 但它**不改变分页规则、不改变尺寸边界**。

// micro-label 的高度（页宽单位）：1080 尺度下约 24px，含上方 6px 的间隔。
export const LABEL_HEIGHT = .022
export const LABEL_GAP = .006

// 页脚右端的标签。等作品有标题输入后换成用户标题（一处常量，替换点明确）。
export const FOOTER_LABEL = 'VOL. 01'

export const pad2 = (value) => String(value).padStart(2, '0')

// 页脚内容：左「序号 / 总页数」，右「全大写标签」。
export function footerFor(index, total, label = FOOTER_LABEL) {
  return {
    page: pad2(index + 1),
    total: pad2(total),
    label: String(label).toUpperCase(),
  }
}

// 一组作品里挑最多 max 页贴 micro-label：**首尾页优先**，其余名额在中间均分 ——
// 与参考图「一组 2–4 处」一致（5 页 → 第 1、3、5 页）。具体贴在哪张照片上由几何层决定。
export function labelPagesFor(pageCount, max = 3) {
  if (pageCount <= 0) return []
  if (pageCount <= max) return Array.from({ length: pageCount }, (_, index) => index)
  const pages = new Set([0, pageCount - 1])
  const slots = max - 2
  for (let step = 1; step <= slots; step += 1) pages.add(Math.round(step * (pageCount - 1) / (slots + 1)))
  return [...pages].sort((a, b) => a - b)
}

// micro-label 的矩形（页面坐标）：贴在卡片**下方**，不压照片内容。
// 这个矩形会并进安全盒，所以别的照片内容不会落在它下面。
export function labelBox(card) {
  return {
    x: card.x,
    y: card.y + card.h + LABEL_GAP,
    w: Math.min(card.w, .34),
    h: LABEL_HEIGHT,
  }
}

// label 文字：用照片在整组里的真实序号（不是装饰性编造的内容）。
export const labelTextFor = (photoIndex) => `FRAME ${pad2(photoIndex + 1)}`
