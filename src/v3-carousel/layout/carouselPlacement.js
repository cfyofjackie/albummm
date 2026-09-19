// PROTOTYPE — V3 的几何层：受控随机的尺寸、放置与轻叠，以及 smart 模式的整组规划。
// 与 carouselSmartPagination.js 一样保持纯函数：输入照片、种子与风格参数，输出页面几何，
// 不读 DOM、不依赖 React，方便用固定种子直接回归。

import { paginatePhotos } from './carouselSmartPagination.js'

export const FRAME_ASPECT = .8 // 4:5 output pages（portrait 规格的页面比例，向后兼容）
export const EXPORT_WIDTH = 1080
export const EXPORT_HEIGHT = 1350

// 页面规格：同一组照片可以按不同比例重新构图，而不是把一种构图缩放塞进另一种画布。
// aspect = 页宽 / 页高；所有几何量都以「页宽的百分比」为单位（y 以页高为 1 保存在卡片里，
// 换算时再除以 aspect）。规格与分页、风格都无关，加一个规格只是加一行常数。
export const PAGE_FORMATS = {
  '4x5': { id: '4x5', label: '4:5', width: 1080, height: 1350, aspect: 4 / 5 },
  '3x4': { id: '3x4', label: '3:4', width: 1080, height: 1440, aspect: 3 / 4 },
  '4x3': { id: '4x3', label: '4:3', width: 1080, height: 810, aspect: 4 / 3 },
}
export const DEFAULT_FORMAT = PAGE_FORMATS['4x5']

// 当前验证已确定的视觉边界：限制照片内容，不限制带白边的外卡片。
export const SIZE_RULES = { minShortEdge: .2, maxContentWidth: .8, maxContentHeight: .78 }

// 「内容短边 ≥ 页面短边的 20%」换算成页宽单位：竖版页面的短边是宽（1），横版是（1/aspect）。
export function shortEdgeFloor(format = DEFAULT_FORMAT) {
  return SIZE_RULES.minShortEdge * Math.min(1, 1 / format.aspect)
}

// 自动缩放：一页在 20% 优先下限之上怎么都放不下时，整页所有卡片统一下调尺寸重排。
// 目的是让「所有照片留在同一页」优先于「短边 ≥ 20%」。阶梯下限（48%）就是缩放的硬边界：
// 极端比例的照片（例如 5:1 全景）在 80% 宽度下短边本来就只有 16%，20% 对它没有意义，
// 所以这里不再额外设短边下限，只记录实际缩到了多少。
export const FITTING_SCALES = [1, .93, .86, .8, .74, .69, .64, .6, .56, .52, .48]

// 材质拆成三条独立的轴（产品设定），任意组合都要成立：
//   边框 BORDER_STYLES —— 相纸白边厚度（none = 原来的缓冲白边；polaroid = 明显宽白边，下边更宽）
//   边缘 EDGE_STYLES   —— 直边或毛边（毛边自带最小出血带：没有纸就撕不出毛边，只能啃照片）
//   胶带 TAPE_STYLES   —— 和纸胶带，每页条数 = 页内照片数 − 1，占位要算进碰撞几何
//
// 三条轴都是**几何参数**，不是 CSS 装饰：白边与胶带都是「照片内容」与「外层卡片相叠」之间的缓冲，
// 厚度 / 占位一变，同一页放得下的东西就变了。数值以 1080 宽的导出尺度为准。
export const BORDER_STYLES = {
  none: { id: 'none', label: '无', side: 1, bottom: 1, chinMax: 0 },
  // chinMax：下边比左右多出来的部分，最多占卡片短边的这个比例 —— 超宽图（长图）不会被套上过厚的下巴。
  polaroid: { id: 'polaroid', label: '拍立得', side: 5, bottom: 12, chinMax: .08 },
}
export const EDGE_STYLES = {
  straight: { id: 'straight', label: '直边', tear: 0, minBand: 0 },
  // 毛边要能看出来：出血带至少 18px（页面宽 1.7%），撕裂深度吃到出血带的 85%。
  // 没有出血带就撕不出毛边（只能啃照片），所以毛边自带这个最小带宽。
  torn: { id: 'torn', label: '毛边', tear: .85, minBand: 18 },
}
export const TAPE_STYLES = {
  off: { id: 'off', label: '无', enabled: false, lengthScale: 0, thickness: 0, protrude: 0 },
  washi: { id: 'washi', label: '和纸胶带', enabled: true, lengthScale: .44, thickness: .019, protrude: .5 },
}
export const DEFAULT_BORDER = BORDER_STYLES.none
export const DEFAULT_EDGE = EDGE_STYLES.straight
export const DEFAULT_TAPE = TAPE_STYLES.off

// 一份材质设定 = 三条轴的组合；组件与几何层之间传的就是这个对象。
export const DEFAULT_MATERIAL = { border: DEFAULT_BORDER, edge: DEFAULT_EDGE, tape: DEFAULT_TAPE }
export const materialOf = (material = {}) => ({
  border: material.border ?? DEFAULT_BORDER,
  edge: material.edge ?? DEFAULT_EDGE,
  tape: material.tape ?? DEFAULT_TAPE,
})

// 每页胶带条数：页内照片数 − 1（2 张 1 条、3 张 2 条、4 张 3 条），至少 1 条。
export function tapeCountFor(photoCount, material = DEFAULT_MATERIAL) {
  const spec = materialOf(material).tape
  if (!spec.enabled || photoCount <= 0) return 0
  return Math.max(1, photoCount - 1)
}

// 三种风格只改变纸面气质与几何参数，不改变分页规则；UI 文案与编号留在组件里。
//
// 注意 smart 模式下每页都有自己的 recipe，recipe 的尺寸字段会覆盖 style 的对应字段，
// 所以「风格差异」必须通过下面三个系数参与进去，否则风格参数就是死代码（曾经如此：
// 三种风格的卡片尺寸差只有 0.03%，见 validation-log.md §11）。语义：
//   anchorScale    锚点（每页第一张）大小系数
//   fragmentScale  陪衬卡片大小系数
//   fragmentRangeScale  陪衬卡片的大小变化幅度（Weekend「尺度变化更快」就靠它）
//   overlapUse     实际吃掉多少「白边预算」作为相叠（白边是碰撞缓冲，所以相叠不会顶到内容区）
//   rotation       旋转幅度（±度）
// anchorShort / fragmentRange 只在没有 recipe 的历史路径（carousel-scatter）里当基准值用。
export const STYLE_LAYOUTS = {
  gallery: {
    overlap: 0, overlapUse: 0, overlapChance: 0, rotation: 0, maxOverlaps: 0,
    anchorScale: .92, fragmentScale: 1, fragmentRangeScale: .5,
    anchorShort: .47, fragmentRange: .1,
  },
  muse: {
    overlap: .08, overlapUse: .5, overlapChance: .5, rotation: .2, maxOverlaps: 1,
    anchorScale: 1, fragmentScale: 1, fragmentRangeScale: 1,
    anchorShort: .43, fragmentRange: .14,
  },
  weekend: {
    overlap: .16, overlapUse: .85, overlapChance: .8, rotation: 2.6, maxOverlaps: 2,
    anchorScale: 1.08, fragmentScale: .9, fragmentRangeScale: 1.5,
    anchorShort: .41, fragmentRange: .18,
  },
}

// 每页张数决定锚点与碎片的基础尺度；风格再在这个基础上做系数。
const BASE_RECIPES = {
  2: { anchorShort: .43, fragmentBase: .26, fragmentRange: .09 },
  3: { anchorShort: .38, fragmentBase: .22, fragmentRange: .06 },
  4: { anchorShort: .34, fragmentBase: .2, fragmentRange: .035 },
}

function smartRecipeFor(count, style = STYLE_LAYOUTS.muse) {
  const base = BASE_RECIPES[count] ?? BASE_RECIPES[3]
  return {
    id: 'smart',
    label: `${count} 张随机组合`,
    anchorShort: base.anchorShort * (style.anchorScale ?? 1),
    fragmentBase: base.fragmentBase * (style.fragmentScale ?? 1),
    fragmentRange: base.fragmentRange * (style.fragmentRangeScale ?? 1),
  }
}

export function rngFrom(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const area = (box) => box.w * box.h

function intersection(a, b) {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return w * h
}

function physicalShortEdge(box, aspect = FRAME_ASPECT) {
  return Math.min(box.w, box.h / aspect)
}

export function matFor(box, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  return matInsets(box, format, material).x
}

// 卡片内缩（px，按 format.width 的导出尺度）：左右/上可以不同（拍立得的下边更宽）。
// 基础白边仍是 2–5px（缓冲），三条材质轴在它上面给系数：
//   - 毛边自带最小出血带 minBand，否则没有纸可撕，只能啃照片；
//   - 拍立得的下巴（bottom − side）按卡片短边封顶，避免超宽图被套上过厚的下边。
export function matInsets(box, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  const { border, edge } = materialOf(material)
  const shortEdgePx = physicalShortEdge(box, format.aspect) * EXPORT_WIDTH
  const base = clamp(Math.round(shortEdgePx * .015), 2, 5)
  const side = Math.max(1, Math.round(Math.max(base * border.side, edge.minBand)))
  const chin = Math.max(0, Math.min(base * (border.bottom - border.side), shortEdgePx * (border.chinMax ?? 0)))
  return { x: side, top: side, bottom: side + Math.round(chin) }
}

// 胶带的实际矩形（页面坐标）：长度按卡片宽度、居中贴在卡片上缘；
// **下端恰好停在照片内容的上边界**（不遮内容），上端越出卡片外框。
// 越出多少取决于白边厚度：白边越厚，胶带越少越出，看起来就像"压住相纸边缘"。
export function tapeRect(card, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  const spec = materialOf(material).tape
  if (!spec.enabled || !card?.tape) return null
  const matTop = (card.mat?.top ?? matInsets(card, format, material).top) / format.width
  const height = spec.thickness
  const out = Math.max(0, height - matTop)
  return {
    x: card.x + card.w / 2 - card.w * spec.lengthScale / 2,
    y: card.y - out,
    w: card.w * spec.lengthScale,
    h: height,
  }
}

export function innerBox(box, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  // 优先用几何层存在卡片上的边框：材质会把边框乘上几倍，若这里按外框重算，
  // 1px 的取整误差会被放大成约 0.5% 页高的偏差，渲染与判定就不再是同一套边框。
  const mat = box.mat ?? matInsets(box, format, material)
  return {
    x: box.x + mat.x / format.width,
    y: box.y + mat.top / format.height,
    w: box.w - mat.x * 2 / format.width,
    h: box.h - (mat.top + mat.bottom) / format.height,
  }
}

// 旋转会让卡片扫出轴对齐包围盒之外，所以「内容区不得碰撞」必须按旋转后的外扩量判断。
const rotationTheta = (rotate = 0) => Math.abs(rotate) * Math.PI / 180

// 旋转后轴对齐包围盒在水平方向多出来的半宽（页宽单位）。
function marginX(box, rotate, format) {
  const theta = rotationTheta(rotate)
  if (!theta) return 0
  return Math.max(0, (box.w * (Math.cos(theta) - 1) + (box.h / format.aspect) * Math.sin(theta)) / 2)
}

// 碰撞判定用的安全盒 = 内容区 + 旋转外扩 + 胶带占位；判据仍是「两个安全盒不相交」。
// 胶带压在卡片上缘、越出卡片外框，所以带上胶带的卡片会把安全盒向上向外撑开 ——
// 这样胶带永远不会落在别的照片内容上（硬边界「内容区不得碰撞」仍然成立）。
function safetyBox(box, format = DEFAULT_FORMAT, rotate = 0, material = DEFAULT_MATERIAL) {
  const inner = innerBox(box, format, material)
  const theta = rotationTheta(rotate)
  let box0 = inner
  if (theta) {
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const heightInWidthUnits = box.h / format.aspect
    const extraX = Math.max(0, (box.w * (cos - 1) + heightInWidthUnits * sin) / 2)
    const extraY = Math.max(0, (box.w * sin + heightInWidthUnits * (cos - 1)) / 2) * format.aspect
    box0 = { x: inner.x - extraX, y: inner.y - extraY, w: inner.w + extraX * 2, h: inner.h + extraY * 2 }
  }
  const tape = tapeRect(box, format, material)
  if (!tape) return box0
  // 胶带占位并进安全盒（取并集，不是外扩）：这样别的照片内容不会落在胶带底下。
  const x0 = Math.min(box0.x, tape.x)
  const y0 = Math.min(box0.y, tape.y)
  const x1 = Math.max(box0.x + box0.w, tape.x + tape.w)
  const y1 = Math.max(box0.y + box0.h, tape.y + tape.h)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function sizeFor(photo, isAnchor, random, style, recipe = null, scale = 1, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  const aspect = photo.width / photo.height
  const floor = shortEdgeFloor(format)
  const desiredShort = isAnchor
    ? (recipe?.anchorShort ?? style.anchorShort) + (random() - .5) * .1
    : (recipe?.fragmentBase ?? floor) + random() * (recipe?.fragmentRange ?? style.fragmentRange)
  let contentW = aspect > 1 ? desiredShort * aspect : desiredShort
  let contentH = contentW * format.aspect / aspect
  const maxScale = Math.min(SIZE_RULES.maxContentWidth / contentW, SIZE_RULES.maxContentHeight / contentH)
  if (maxScale < 1) {
    contentW *= maxScale
    contentH *= maxScale
  }
  const currentShortEdge = Math.min(contentW, contentH / format.aspect)
  const minScale = floor / currentShortEdge
  if (minScale > 1 && contentW * minScale <= SIZE_RULES.maxContentWidth && contentH * minScale <= SIZE_RULES.maxContentHeight) {
    contentW *= minScale
    contentH *= minScale
  }
  // 整页自动缩放放在最后：它优先于短边下限（阶梯下限 48% 才是硬边界）。
  contentW *= scale
  contentH *= scale
  // 白边在视觉上不应吃掉内容尺度，因此在内容尺寸之外增加外卡片边界。
  const mat = matInsets({ w: contentW, h: contentH }, format, material)
  return { w: contentW + mat.x * 2 / format.width, h: contentH + (mat.top + mat.bottom) / format.height, mat }
}

function pairedCandidate(anchor, w, h, random, style, format, rotate) {
  // 旋转会让卡片扫出包围盒，位置候选的间隙要把这部分让出来，否则候选几乎总被拒。
  const sweep = marginX({ w, h }, rotate, format) + marginX(anchor, anchor.rotate ?? 0, format)
  const overlapX = style.overlap ? Math.min(anchor.w, w) * style.overlap * .28 : 0
  const overlapY = style.overlap ? Math.min(anchor.h, h) * style.overlap * .28 : 0
  const gapX = .022 + sweep - overlapX
  const gapY = .022 + sweep - overlapY
  const options = []
  const midX = clamp(anchor.x + (anchor.w - w) / 2 + (random() - .5) * .06, .04, .96 - w)
  const midY = clamp(anchor.y + (anchor.h - h) / 2 + (random() - .5) * .06, .06, .94 - h)
  const right = anchor.x + anchor.w + gapX
  const left = anchor.x - w - gapX
  const below = anchor.y + anchor.h + gapY
  const above = anchor.y - h - gapY
  if (right + w <= .96) options.push({ x: right, y: midY })
  if (left >= .04) options.push({ x: left, y: midY })
  if (below + h <= .94) options.push({ x: midX, y: below })
  if (above >= .06) options.push({ x: midX, y: above })
  return options.length ? options[Math.floor(random() * options.length)] : null
}

function candidateFor(photo, isAnchor, random, style, anchor = null, recipe = null, scale = 1, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  const { w, h, mat } = sizeFor(photo, isAnchor, random, style, recipe, scale, format, material)
  const rotate = (random() - .5) * style.rotation * 2
  // 先决定这一轮用哪种「贴法」：风格想轻叠时优先试相叠，否则用留缝并排。
  // 旧写法把相叠放在并排之后、只有并排无解时才轮到它，于是实测三种风格的轻叠数都是 0。
  const wantsOverlap = anchor && style.overlapUse > 0 && random() < style.overlapChance
  if (wantsOverlap) {
    // 白边是碰撞缓冲：只在「两张白边的总宽」内相叠，视觉上有叠放，内容区永远不接触。
    const budget = ((anchor.mat?.x ?? matInsets(anchor, format, material).x) + mat.x) / format.width
    const overlap = budget * style.overlapUse * (.5 + random() * .5)
    const toRight = random() < .5
    return {
      x: clamp(toRight ? anchor.x + anchor.w - overlap : anchor.x - w + overlap, .07, .93 - w),
      y: clamp(anchor.y + (random() - .5) * Math.min(anchor.h, h) * .45, .11, .91 - h),
      w,
      h,
      mat,
      rotate,
    }
  }
  if (anchor && recipe) {
    const pair = pairedCandidate(anchor, w, h, random, style, format, rotate)
    if (pair) return { ...pair, w, h, mat, rotate }
  }
  return {
    x: .07 + random() * Math.max(.01, .86 - w),
    y: .11 + random() * Math.max(.01, .8 - h),
    w,
    h,
    mat,
    rotate,
  }
}

function acceptable(box, placed, style, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  // 用「内容区 + 旋转外扩」的安全盒判断碰撞：即使卡片带旋转，内容区也不会互相压到。
  const safety = safetyBox(box, format, box.rotate ?? 0, material)
  let cardOverlaps = 0
  for (const other of placed) {
    const cardRatio = intersection(box, other) / Math.min(area(box), area(other))
    if (cardRatio > style.overlap) return null
    if (intersection(safety, safetyBox(other, format, other.rotate ?? 0, material)) > .0001) return null
    if (cardRatio > 0) cardOverlaps += 1
  }
  if (cardOverlaps > style.maxOverlaps) return null
  return cardOverlaps
}

function fallbackFor(photo, index, style, recipe, scale = 1, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL, tape = false) {
  const { w, h, mat } = sizeFor(photo, index === 0, () => .5, style, recipe, scale, format, material)
  return { x: .1 + index * .08, y: .12 + index * .12, w, h, mat, tape, rotate: 0 }
}

function safeFallback(photo, index, placed, style, recipe, scale = 1, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL, tape = false) {
  const base = fallbackFor(photo, index, style, recipe, scale, format, material, tape)
  // 节奏页面不靠缩小回退；更细的搜索网格优先给当前页找到合法空位，
  // 避免一张陪衬图顺延后破坏下一页的“安静区”。
  const grid = [.04, .16, .28, .4, .52, .64, .76, .88]
  for (const y of grid) {
    for (const x of grid) {
      const candidate = { ...base, x: clamp(x, .04, .96 - base.w), y: clamp(y, .06, .94 - base.h) }
      const cardOverlaps = acceptable(candidate, placed, style, format, material)
      if (cardOverlaps != null) return { box: candidate, cardOverlaps }
    }
  }
  return null
}

function contentCollisions(placed, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  return placed.reduce((sum, box, index) => sum + placed.slice(index + 1).filter(
    (other) => intersection(safetyBox(box, format, box.rotate ?? 0, material), safetyBox(other, format, other.rotate ?? 0, material)) > .0001,
  ).length, 0)
}

export function placeFrame(photos, random, style, recipe = null, scale = 1, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  const placed = []
  const unplaced = []
  let rejected = 0
  let overlaps = 0
  // 胶带条数 = 页内照片数 − 1（至少 1 条），贴在最先放下的那几张卡片上。
  // 带胶带的卡片在碰撞判定里会多占一块位置（safetyBox 把胶带占位撑进去），
  // 所以胶带永远不会压到别的照片内容上。
  const tapeCount = tapeCountFor(photos.length, material)
  photos.forEach((photo, index) => {
    const taped = index < tapeCount
    let chosen = null
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const base = candidateFor(photo, placed.length === 0, random, style, placed[0], recipe, scale, format, material)
      const candidate = taped ? { ...base, tape: true } : base
      const cardOverlaps = acceptable(candidate, placed, style, format, material)
      if (cardOverlaps == null) {
        rejected += 1
        continue
      }
      chosen = candidate
      overlaps += cardOverlaps
      break
    }
    if (chosen) {
      placed.push({ photo, ...chosen })
    } else {
      const fallback = safeFallback(photo, index, placed, style, recipe, scale, format, material, taped)
      if (fallback) {
        overlaps += fallback.cardOverlaps
        placed.push({ photo, ...fallback.box })
      } else {
        // 不再靠缩小照片塞进去；交给下一页处理。
        unplaced.push(photo)
      }
    }
  })
  // 胶带条数按「这一页最后真正放下的照片数」结算：有照片顺延到下一页时，多出来的胶带要去掉 ——
  // 规格是每页 = 页内照片数 − 1，不是「计划照片数 − 1」。
  const finalTapeCount = tapeCountFor(placed.length, material)
  placed.forEach((card, index) => {
    if (card.tape && index >= finalTapeCount) delete card.tape
  })
  return { placed, unplaced, rejected, overlaps, contentCollisions: contentCollisions(placed, format, material) }
}

// 同一组照片生成多轮候选，选择完整放下且拒绝次数最低的一轮；“换一组排法”仍然只改种子。
// 整页放不下时（超宽 + 超长配成一页的典型情况），按 FITTING_SCALES 统一下调尺寸重排，
// 取「整页都放得下」的最大缩放——这取代了以前「让一张照片顺延成单图页」的行为。
// 阶梯试到底仍有照片放不下时，才顺延成补充页，由 planSmartStory 兜住，不丢图。
export function placeFrameBest(photos, seed, style, recipe, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  let best = null
  for (const scale of FITTING_SCALES) {
    let candidate = null
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const run = placeFrame(photos, rngFrom(seed + attempt * 7919), style, recipe, scale, format, material)
      const score = run.placed.length * 10000 - run.unplaced.length * 10000 - run.rejected * 2 - run.overlaps
      if (!candidate || score > candidate.score) candidate = { ...run, score, fittingScale: scale }
      if (run.unplaced.length === 0 && run.rejected === 0) break
    }
    if (!best || candidate.score > best.score) best = candidate
    if (candidate.unplaced.length === 0) return best
  }
  return { ...best, gaveUp: true }
}

// smart 模式：分页先定，再在每页内做受控随机。放不下的照片顺延为补充页，
// 而不是缩小照片硬塞；补充页仍需通过同一套尺寸与碰撞规则。
export function planSmartStory(photos, seed, style, format = DEFAULT_FORMAT, material = DEFAULT_MATERIAL) {
  const random = rngFrom(seed)
  const groups = paginatePhotos(photos, random).map((group) => ({
    photos: group,
    recipe: smartRecipeFor(group.length, style),
  }))
  const frames = []
  groups.forEach(({ photos: group, recipe }, index) => {
    const placedFrame = placeFrameBest(group, seed + index * 104729, style, recipe, format, material)
    frames.push({ ...placedFrame, recipe })
    let overflow = placedFrame.unplaced
    const overflowRecipe = smartRecipeFor(Math.min(4, Math.max(2, overflow.length)), style)
    while (overflow.length) {
      const overflowFrame = placeFrameBest(overflow, seed + frames.length * 104729, style, overflowRecipe, format, material)
      frames.push({ ...overflowFrame, recipe: overflowRecipe })
      if (!overflowFrame.placed.length) {
        frames.push({ ...placeFrame([overflow[0]], random, style, overflowRecipe, 1, format, material), recipe: overflowRecipe })
        overflow = overflow.slice(1)
      } else {
        overflow = overflowFrame.unplaced
      }
    }
  })
  return {
    frames,
    pagePlan: groups.map((group) => group.photos.length),
    rejected: frames.reduce((sum, frame) => sum + frame.rejected, 0),
    overlaps: frames.reduce((sum, frame) => sum + frame.overlaps, 0),
    contentCollisions: frames.reduce((sum, frame) => sum + frame.contentCollisions, 0),
  }
}
