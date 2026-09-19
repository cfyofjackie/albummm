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

// 材质 / 边框规格：白边不只是装饰，它是照片内容与「外层卡片相叠」之间的缓冲，
// 所以边框厚度必须同时进入几何计算（下面的 matInsets / innerBox），否则渲染出来的
// 边框和碰撞判定用的边框不是同一套，「内容区不得碰撞」的保证就失效了。
//   side    左右/上边的厚度 = 基础白边 × side
//   bottom  下边厚度 = 基础白边 × bottom（拍立得的宽下边靠它）
//   tear    撕边深度占边框厚度的比例（必须 < 1，否则会啃到照片内容）
//   tape    该材质是否带胶带（每组作品最多 1–2 处，由页号决定）
export const FRAME_STYLES = {
  plain: { id: 'plain', label: '无', side: 1, bottom: 1, tear: 0, tape: false },
  polaroid: { id: 'polaroid', label: '拍立得', side: 2.2, bottom: 5.5, tear: 0, tape: false },
  torn: { id: 'torn', label: '撕纸', side: 3, bottom: 3, tear: .38, tape: true },
}
export const DEFAULT_FRAME = FRAME_STYLES.plain

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

export function matFor(box, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  return matInsets(box, format, frame).x
}

// 卡片内缩（px，按 format.width 的导出尺度）：左右上下可以不同（拍立得的宽下边）。
// 基础白边仍是 2–5px（guardrails 第 3 节），材质只是在它上面乘系数。
export function matInsets(box, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  const base = clamp(Math.round(physicalShortEdge(box, format.aspect) * EXPORT_WIDTH * .015), 2, 5)
  return {
    x: Math.max(1, Math.round(base * frame.side)),
    top: Math.max(1, Math.round(base * frame.side)),
    bottom: Math.max(1, Math.round(base * frame.bottom)),
  }
}

export function innerBox(box, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  // 优先用几何层存在卡片上的边框：材质会把边框乘上 2.2-5.5 的系数，若这里按外框重算，
  // 1px 的取整误差会被放大成约 0.5% 页高的偏差，渲染与碰撞判定就不再是同一套边框。
  const mat = box.mat ?? matInsets(box, format, frame)
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

// 碰撞判定用的安全盒 = 内容区 + 旋转外扩；判据仍是「两个安全盒不相交」。
function safetyBox(box, format = DEFAULT_FORMAT, rotate = 0, frame = DEFAULT_FRAME) {
  const inner = innerBox(box, format, frame)
  const theta = rotationTheta(rotate)
  if (!theta) return inner
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const heightInWidthUnits = box.h / format.aspect
  const extraX = Math.max(0, (box.w * (cos - 1) + heightInWidthUnits * sin) / 2)
  const extraY = Math.max(0, (box.w * sin + heightInWidthUnits * (cos - 1)) / 2) * format.aspect
  return {
    x: inner.x - extraX,
    y: inner.y - extraY,
    w: inner.w + extraX * 2,
    h: inner.h + extraY * 2,
  }
}

function sizeFor(photo, isAnchor, random, style, recipe = null, scale = 1, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
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
  const mat = matInsets({ w: contentW, h: contentH }, format, frame)
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

function candidateFor(photo, isAnchor, random, style, anchor = null, recipe = null, scale = 1, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  const { w, h, mat } = sizeFor(photo, isAnchor, random, style, recipe, scale, format, frame)
  const rotate = (random() - .5) * style.rotation * 2
  // 先决定这一轮用哪种「贴法」：风格想轻叠时优先试相叠，否则用留缝并排。
  // 旧写法把相叠放在并排之后、只有并排无解时才轮到它，于是实测三种风格的轻叠数都是 0。
  const wantsOverlap = anchor && style.overlapUse > 0 && random() < style.overlapChance
  if (wantsOverlap) {
    // 白边是碰撞缓冲：只在「两张白边的总宽」内相叠，视觉上有叠放，内容区永远不接触。
    const budget = ((anchor.mat?.x ?? matInsets(anchor, format, frame).x) + mat.x) / format.width
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

function acceptable(box, placed, style, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  // 用「内容区 + 旋转外扩」的安全盒判断碰撞：即使卡片带旋转，内容区也不会互相压到。
  const safety = safetyBox(box, format, box.rotate ?? 0, frame)
  let cardOverlaps = 0
  for (const other of placed) {
    const cardRatio = intersection(box, other) / Math.min(area(box), area(other))
    if (cardRatio > style.overlap) return null
    if (intersection(safety, safetyBox(other, format, other.rotate ?? 0, frame)) > .0001) return null
    if (cardRatio > 0) cardOverlaps += 1
  }
  if (cardOverlaps > style.maxOverlaps) return null
  return cardOverlaps
}

function fallbackFor(photo, index, style, recipe, scale = 1, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  const { w, h, mat } = sizeFor(photo, index === 0, () => .5, style, recipe, scale, format, frame)
  return { x: .1 + index * .08, y: .12 + index * .12, w, h, mat, rotate: 0 }
}

function safeFallback(photo, index, placed, style, recipe, scale = 1, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  const base = fallbackFor(photo, index, style, recipe, scale, format, frame)
  // 节奏页面不靠缩小回退；更细的搜索网格优先给当前页找到合法空位，
  // 避免一张陪衬图顺延后破坏下一页的“安静区”。
  const grid = [.04, .16, .28, .4, .52, .64, .76, .88]
  for (const y of grid) {
    for (const x of grid) {
      const candidate = { ...base, x: clamp(x, .04, .96 - base.w), y: clamp(y, .06, .94 - base.h) }
      const cardOverlaps = acceptable(candidate, placed, style, format, frame)
      if (cardOverlaps != null) return { box: candidate, cardOverlaps }
    }
  }
  return null
}

function contentCollisions(placed, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  return placed.reduce((sum, box, index) => sum + placed.slice(index + 1).filter(
    (other) => intersection(safetyBox(box, format, box.rotate ?? 0, frame), safetyBox(other, format, other.rotate ?? 0, frame)) > .0001,
  ).length, 0)
}

export function placeFrame(photos, random, style, recipe = null, scale = 1, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  const placed = []
  const unplaced = []
  let rejected = 0
  let overlaps = 0
  photos.forEach((photo, index) => {
    let chosen = null
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = candidateFor(photo, placed.length === 0, random, style, placed[0], recipe, scale, format, frame)
      const cardOverlaps = acceptable(candidate, placed, style, format, frame)
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
      const fallback = safeFallback(photo, index, placed, style, recipe, scale, format, frame)
      if (fallback) {
        overlaps += fallback.cardOverlaps
        placed.push({ photo, ...fallback.box })
      } else {
        // 不再靠缩小照片塞进去；交给下一页处理。
        unplaced.push(photo)
      }
    }
  })
  return { placed, unplaced, rejected, overlaps, contentCollisions: contentCollisions(placed, format, frame) }
}

// 同一组照片生成多轮候选，选择完整放下且拒绝次数最低的一轮；“换一组排法”仍然只改种子。
// 整页放不下时（超宽 + 超长配成一页的典型情况），按 FITTING_SCALES 统一下调尺寸重排，
// 取「整页都放得下」的最大缩放——这取代了以前「让一张照片顺延成单图页」的行为。
// 阶梯试到底仍有照片放不下时，才顺延成补充页，由 planSmartStory 兜住，不丢图。
export function placeFrameBest(photos, seed, style, recipe, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  let best = null
  for (const scale of FITTING_SCALES) {
    let candidate = null
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const run = placeFrame(photos, rngFrom(seed + attempt * 7919), style, recipe, scale, format, frame)
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
export function planSmartStory(photos, seed, style, format = DEFAULT_FORMAT, frame = DEFAULT_FRAME) {
  const random = rngFrom(seed)
  const groups = paginatePhotos(photos, random).map((group) => ({
    photos: group,
    recipe: smartRecipeFor(group.length, style),
  }))
  const frames = []
  groups.forEach(({ photos: group, recipe }, index) => {
    const placedFrame = placeFrameBest(group, seed + index * 104729, style, recipe, format, frame)
    frames.push({ ...placedFrame, recipe })
    let overflow = placedFrame.unplaced
    const overflowRecipe = smartRecipeFor(Math.min(4, Math.max(2, overflow.length)), style)
    while (overflow.length) {
      const overflowFrame = placeFrameBest(overflow, seed + frames.length * 104729, style, overflowRecipe, format, frame)
      frames.push({ ...overflowFrame, recipe: overflowRecipe })
      if (!overflowFrame.placed.length) {
        frames.push({ ...placeFrame([overflow[0]], random, style, overflowRecipe, 1, format, frame), recipe: overflowRecipe })
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
