// PROTOTYPE — V3 的几何层：受控随机的尺寸、放置与轻叠，以及 smart 模式的整组规划。
// 与 carouselSmartPagination.js 一样保持纯函数：输入照片、种子与风格参数，输出页面几何，
// 不读 DOM、不依赖 React，方便用固定种子直接回归。

import { paginatePhotos } from './carouselSmartPagination.js'

export const FRAME_ASPECT = .8 // 4:5 output pages
export const EXPORT_WIDTH = 1080
export const EXPORT_HEIGHT = 1350
// 当前验证已确定的视觉边界：限制照片内容，不限制带白边的外卡片。
export const SIZE_RULES = { minShortEdge: .2, maxContentWidth: .8, maxContentHeight: .78 }

// 自动缩放：一页在 20% 优先下限之上怎么都放不下时，整页所有卡片统一下调尺寸重排。
// 目的是让「所有照片留在同一页」优先于「短边 ≥ 20%」。阶梯下限（48%）就是缩放的硬边界：
// 极端比例的照片（例如 5:1 全景）在 80% 宽度下短边本来就只有 16%，20% 对它没有意义，
// 所以这里不再额外设短边下限，只记录实际缩到了多少。
export const FITTING_SCALES = [1, .93, .86, .8, .74, .69, .64, .6, .56, .52, .48]

// 三种风格只改变纸面气质与几何参数，不改变分页规则；UI 文案与编号留在组件里。
export const STYLE_LAYOUTS = {
  gallery: { overlap: 0, rotation: 0, overlapChance: 0, anchorShort: .47, fragmentRange: .1, maxOverlaps: 0 },
  muse: { overlap: .08, rotation: .45, overlapChance: .45, anchorShort: .43, fragmentRange: .14, maxOverlaps: 1 },
  weekend: { overlap: .16, rotation: 1.8, overlapChance: .68, anchorShort: .41, fragmentRange: .18, maxOverlaps: 1 },
}

function smartRecipeFor(count) {
  const recipes = {
    2: { anchorShort: .43, fragmentBase: .26, fragmentRange: .09 },
    3: { anchorShort: .38, fragmentBase: .22, fragmentRange: .06 },
    4: { anchorShort: .34, fragmentBase: .2, fragmentRange: .035 },
  }
  return { id: 'smart', ...recipes[count], label: `${count} 张随机组合` }
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

function physicalShortEdge(box) {
  return Math.min(box.w, box.h / FRAME_ASPECT)
}

export function matFor(box) {
  // 以 1080×1350 导出画布估算：小卡片 2px，大卡片最多 5px。
  return clamp(Math.round(physicalShortEdge(box) * EXPORT_WIDTH * .015), 2, 5)
}

export function innerBox(box) {
  const mat = matFor(box)
  const insetX = mat / EXPORT_WIDTH
  const insetY = mat / EXPORT_HEIGHT
  return { x: box.x + insetX, y: box.y + insetY, w: box.w - insetX * 2, h: box.h - insetY * 2 }
}

function sizeFor(photo, isAnchor, random, style, recipe = null, scale = 1) {
  const aspect = photo.width / photo.height
  const desiredShort = isAnchor
    ? (recipe?.anchorShort ?? style.anchorShort) + (random() - .5) * .1
    : (recipe?.fragmentBase ?? SIZE_RULES.minShortEdge) + random() * (recipe?.fragmentRange ?? style.fragmentRange)
  let contentW = aspect > 1 ? desiredShort * aspect : desiredShort
  let contentH = contentW * FRAME_ASPECT / aspect
  const maxScale = Math.min(SIZE_RULES.maxContentWidth / contentW, SIZE_RULES.maxContentHeight / contentH)
  if (maxScale < 1) {
    contentW *= maxScale
    contentH *= maxScale
  }
  const currentShortEdge = Math.min(contentW, contentH / FRAME_ASPECT)
  const minScale = SIZE_RULES.minShortEdge / currentShortEdge
  if (minScale > 1 && contentW * minScale <= SIZE_RULES.maxContentWidth && contentH * minScale <= SIZE_RULES.maxContentHeight) {
    contentW *= minScale
    contentH *= minScale
  }
  // 整页自动缩放放在最后：它优先于 20% 下限，但由 MIN_FITTING_SHORT_EDGE 兜底。
  contentW *= scale
  contentH *= scale
  // 白边在视觉上不应吃掉内容尺度，因此在内容尺寸之外增加外卡片边界。
  const mat = matFor({ w: contentW, h: contentH })
  return { w: contentW + mat * 2 / EXPORT_WIDTH, h: contentH + mat * 2 / EXPORT_HEIGHT }
}

function pairedCandidate(anchor, w, h, random, style) {
  const overlapX = style.overlap ? Math.min(anchor.w, w) * style.overlap * .28 : 0
  const overlapY = style.overlap ? Math.min(anchor.h, h) * style.overlap * .28 : 0
  const gapX = .022 - overlapX
  const gapY = .022 - overlapY
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

function candidateFor(photo, isAnchor, random, style, anchor = null, recipe = null, scale = 1) {
  const { w, h } = sizeFor(photo, isAnchor, random, style, recipe, scale)
  if (anchor && recipe) {
    const pair = pairedCandidate(anchor, w, h, random, style)
    if (pair) {
      return { ...pair, w, h, rotate: (random() - .5) * style.rotation * 2 }
    }
  }
  // 有白边时，让辅助卡片偶尔贴着第一张的外缘：视觉上有叠放，
  // 但重叠宽度小于两张白边的总缓冲，内层照片依然不会相撞。
  if (anchor && style.overlap > 0 && random() < style.overlapChance) {
    const overlap = .025 + random() * style.overlap * .42
    const toRight = random() < .5
    return {
      x: clamp(toRight ? anchor.x + anchor.w - w * overlap : anchor.x - w + w * overlap, .07, .93 - w),
      y: clamp(anchor.y + (random() - .5) * Math.min(anchor.h, h) * .45, .11, .91 - h),
      w,
      h,
      rotate: (random() - .5) * style.rotation * 2,
    }
  }
  return {
    x: .07 + random() * Math.max(.01, .86 - w),
    y: .11 + random() * Math.max(.01, .8 - h),
    w,
    h,
    rotate: (random() - .5) * style.rotation * 2,
  }
}

function acceptable(box, placed, style) {
  const inner = innerBox(box)
  let cardOverlaps = 0
  for (const other of placed) {
    const cardRatio = intersection(box, other) / Math.min(area(box), area(other))
    if (cardRatio > style.overlap) return null
    if (intersection(inner, innerBox(other)) > .0001) return null
    if (cardRatio > 0) cardOverlaps += 1
  }
  if (cardOverlaps > style.maxOverlaps) return null
  return cardOverlaps
}

function fallbackFor(photo, index, style, recipe, scale = 1) {
  const { w, h } = sizeFor(photo, index === 0, () => .5, style, recipe, scale)
  return { x: .1 + index * .08, y: .12 + index * .12, w, h, rotate: 0 }
}

function safeFallback(photo, index, placed, style, recipe, scale = 1) {
  const base = fallbackFor(photo, index, style, recipe, scale)
  // 节奏页面不靠缩小回退；更细的搜索网格优先给当前页找到合法空位，
  // 避免一张陪衬图顺延后破坏下一页的“安静区”。
  const grid = [.04, .16, .28, .4, .52, .64, .76, .88]
  for (const y of grid) {
    for (const x of grid) {
      const candidate = { ...base, x: clamp(x, .04, .96 - base.w), y: clamp(y, .06, .94 - base.h) }
      const cardOverlaps = acceptable(candidate, placed, style)
      if (cardOverlaps != null) return { box: candidate, cardOverlaps }
    }
  }
  return null
}

function contentCollisions(placed) {
  return placed.reduce((sum, box, index) => sum + placed.slice(index + 1).filter(
    (other) => intersection(innerBox(box), innerBox(other)) > .0001,
  ).length, 0)
}

export function placeFrame(photos, random, style, recipe = null, scale = 1) {
  const placed = []
  const unplaced = []
  let rejected = 0
  let overlaps = 0
  photos.forEach((photo, index) => {
    let chosen = null
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = candidateFor(photo, placed.length === 0, random, style, placed[0], recipe, scale)
      const cardOverlaps = acceptable(candidate, placed, style)
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
      const fallback = safeFallback(photo, index, placed, style, recipe, scale)
      if (fallback) {
        overlaps += fallback.cardOverlaps
        placed.push({ photo, ...fallback.box })
      } else {
        // 不再靠缩小照片塞进去；交给下一页处理。
        unplaced.push(photo)
      }
    }
  })
  return { placed, unplaced, rejected, overlaps, contentCollisions: contentCollisions(placed) }
}

function frameShortEdge(placed) {
  return placed.length ? Math.min(...placed.map((card) => physicalShortEdge(innerBox(card)))) : 0
}

// 同一组照片生成多轮候选，选择完整放下且拒绝次数最低的一轮；“换一组排法”仍然只改种子。
// 整页放不下时（超宽 + 超长配成一页的典型情况），按 FITTING_SCALES 统一下调尺寸重排，
// 取「整页都放得下」的最大缩放——这取代了以前「让一张照片顺延成单图页」的行为。
// 阶梯试到底仍有照片放不下时，才顺延成补充页，由 planSmartStory 兜住，不丢图。
export function placeFrameBest(photos, seed, style, recipe) {
  let best = null
  for (const scale of FITTING_SCALES) {
    let candidate = null
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const run = placeFrame(photos, rngFrom(seed + attempt * 7919), style, recipe, scale)
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
export function planSmartStory(photos, seed, style) {
  const random = rngFrom(seed)
  const groups = paginatePhotos(photos, random).map((group) => ({
    photos: group,
    recipe: smartRecipeFor(group.length),
  }))
  const frames = []
  groups.forEach(({ photos: group, recipe }, index) => {
    const frame = placeFrameBest(group, seed + index * 104729, style, recipe)
    frames.push({ ...frame, recipe })
    let overflow = frame.unplaced
    const overflowRecipe = smartRecipeFor(Math.min(4, Math.max(2, overflow.length)))
    while (overflow.length) {
      const overflowFrame = placeFrameBest(overflow, seed + frames.length * 104729, style, overflowRecipe)
      frames.push({ ...overflowFrame, recipe: overflowRecipe })
      if (!overflowFrame.placed.length) {
        frames.push({ ...placeFrame([overflow[0]], random, style, overflowRecipe), recipe: overflowRecipe })
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
