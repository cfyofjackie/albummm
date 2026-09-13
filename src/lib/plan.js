// 排版引擎：photos + style + seed + format → pages[]
// 纯函数，无 DOM 依赖。
//
// 策略（见 SLC.md 五、六）：
// - 单图页为主，多图页为亮点；每页最多 3 张
// - 图片方向驱动模板选择：竖图 → 偏置单图/左右双图；横图 → 大单图/上下双图；
//   超长图优先收编进三图页，避免在 4:5 页内大面积留白
// - 数量分档：5–7 以单图为主（至多 1 个双图页）；8–12 单双混排（至多 1 个三图页）；
//   13–20 增加双图页比例，仍保留单图页维持节奏
// - 可 seed 伪随机：同 seed 结果一致，换 seed 重新生成

import { getPageFormat, isFullBleedCompatible, isSpreadBleedCompatible } from './pageFormat.js'

export const MIN_PHOTOS = 5
export const MAX_PHOTOS = 20

// ---------- 可 seed 伪随机 ----------

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ---------- 风格参数 ----------

const STYLE_PARAMS = {
  gallery: {
    singles: {
      'single-center': 3,
      'single-top': 2,
      'single-bottom': 2,
      'single-small': 1,
      'single-offset': 2,
      'single-full': 1,
    },
    opener: 'single-center',
    doublesByTier: { small: [1, 1], mid: [1, 2], large: [2, 3] },
    triplesByTier: { small: 0, mid: 0, large: 1 },
    gap: [2, 3], // 每隔 2–3 个单图页安排一个多图页
  },
  rhythm: {
    singles: {
      'single-center': 2,
      'single-top': 2,
      'single-bottom': 2,
      'single-small': 1,
      'single-offset': 1,
      'single-full': 3,
    },
    opener: 'single-full',
    doublesByTier: { small: [1, 1], mid: [1, 3], large: [3, 5] },
    triplesByTier: { small: 0, mid: 1, large: 2 },
    gap: [1, 2],
  },
  frame: {
    singles: {
      'single-center': 3,
      'single-top': 2,
      'single-bottom': 2,
      'single-small': 2,
      'single-offset': 1,
      'single-full': 0,
    },
    opener: 'single-center',
    doublesByTier: { small: [1, 1], mid: [1, 2], large: [2, 4] },
    triplesByTier: { small: 0, mid: 1, large: 1 },
    gap: [2, 2],
  },
}

// ---------- 摄影书模式（跨页优先） ----------

// 这一模式不把跨页当成两个碰巧相邻的单页，而是先把两页视作一个画布。
// 每个 studio 单元稳定输出左右两页，确保装订后不会错位。
function makeStudioSpread(layoutId, photos, spreadId, extra = {}) {
  const imageIds = photos.map((photo) => photo.id)
  const shared = {
    layoutId,
    spreadId,
    imageIds,
    ...extra,
  }
  return [
    {
      type: 'studio',
      layoutId,
      imageIds,
      studio: { ...shared, side: 'left' },
    },
    {
      type: 'studio',
      layoutId,
      imageIds: [], // 图片仅由左页计入排版消耗；两页共享 studio.imageIds。
      studio: { ...shared, side: 'right' },
    },
  ]
}

// 铺满整张跨页画布（满版用 cover 裁切，横幅用 contain 完整展示）。
function fullCanvasBox(photo, fit) {
  return { photoId: photo.id, x: 0, y: 0, w: 100, h: 100, fit }
}

// T2 跨页留白：把整张跨页画布四边各内缩 margin%（按宽度算，所以四边视觉等宽），
// 得到的框交给 contain 居中放图——比例不匹配时多出来的空间落在其中一轴上，但不裁图。
function insetBox(photo, formatId, margin = 6) {
  const spreadAspect = getPageFormat(formatId).aspect * 2
  return {
    photoId: photo.id,
    x: margin,
    y: margin * spreadAspect,
    w: 100 - margin * 2,
    h: 100 - margin * 2 * spreadAspect,
    fit: 'contain',
  }
}

// ---------- 盒子：单页模块 ----------
// 单页模块绑在某一页上（左半 / 右半），可以对页放别的模块或留白。
// 边距沿用原来的双图白边：页宽的 8% / 页高的 10%（换算成画布百分比就是 4 / 10）。
const PAGE_MARGIN_X = 4
const PAGE_MARGIN_Y = 10

function halfOrigin(side) {
  return side === 'left' ? 0 : 50
}

// 一张图占一页：页内留白、尽量放大（contain，所以不裁切）。
function singleBox(photo, formatId, side) {
  const origin = halfOrigin(side)
  return {
    photoId: photo.id,
    x: origin + PAGE_MARGIN_X,
    y: PAGE_MARGIN_Y,
    w: 50 - PAGE_MARGIN_X * 2,
    h: 100 - PAGE_MARGIN_Y * 2,
    fit: 'contain',
    plate: true,
  }
}

// 两张图占一页：统一高度、按各自比例定宽、共用中轴、等距。
// 放不下就返回 null——准入由尺寸决定，不硬塞。
function stack2Boxes(photos, formatId, side, gap = 4) {
  const spreadAspect = getPageFormat(formatId).aspect * 2
  const maxW = 50 - PAGE_MARGIN_X * 2
  const maxTotalH = 100 - PAGE_MARGIN_Y * 2
  const byHeight = (maxTotalH - gap) / 2
  const height = Math.min(
    byHeight,
    ...photos.map((photo) => (maxW * spreadAspect) / (photo.width / photo.height)),
  )
  if (height < 24) return null // 两张都太小，不如各自占一页
  const widths = photos.map((photo) => (height * (photo.width / photo.height)) / spreadAspect)
  const origin = halfOrigin(side)
  const total = height * 2 + gap
  let y = (100 - total) / 2
  return photos.map((photo, index) => {
    const box = {
      photoId: photo.id,
      x: origin + (50 - widths[index]) / 2,
      y,
      w: widths[index],
      h: height,
      fit: 'contain',
      plate: true,
    }
    y += height + gap
    return box
  })
}

function triptychBoxes(photos, formatId) {
  const pageAspect = getPageFormat(formatId).aspect
  const spreadAspect = pageAspect * 2
  const gap = 2.4
  const usableWidth = 88 - gap * (photos.length - 1)
  const totalAspect = photos.reduce((sum, photo) => sum + photo.width / photo.height, 0)
  // 统一照片高度，宽度按原始比例变化；控制上限以保留足够的上下白边。
  const height = Math.min(66, (usableWidth * spreadAspect) / totalAspect)
  const widths = photos.map((photo) => (height * (photo.width / photo.height)) / spreadAspect)
  const used = widths.reduce((sum, width) => sum + width, 0) + gap * (photos.length - 1)
  let x = (100 - used) / 2
  const y = (100 - height) / 2
  return photos.map((photo, index) => {
    const box = { photoId: photo.id, x, y, w: widths[index], h: height }
    x += widths[index] + gap
    return box
  })
}

function planStudioPages(photos, seed, formatId) {
  const rng = mulberry32(hashSeed(`studio-${seed}`))
  const pool = photos.map((photo, index) => ({ ...photo, _i: index }))
  const pages = []
  let spreadIndex = 0
  const append = (layoutId, members, extra) => {
    pages.push(...makeStudioSpread(layoutId, members, `studio-${spreadIndex++}`, extra))
  }

  // 开篇优先把一张比例匹配的横图做成跨页主视觉；比例不够接近满版时不裁图，
  // 改走 T2「跨页留白」（四周等宽白边）——宁可留白也不破坏原图比例。
  // 超宽图（>1.8）不参与：它们有自己的 T3 横幅（宽度顶满、完整不裁）。
  const heroCandidates = pool.filter(
    (photo) => isWideish(photo) && photo.orientation !== 'ultra-wide',
  )
  if (heroCandidates.length > 0) {
    const hero = heroCandidates.reduce((best, photo) => (area(photo) > area(best) ? photo : best))
    pool.splice(pool.indexOf(hero), 1)
    if (isSpreadBleedCompatible(hero, formatId)) {
      append('studio-hero', [hero], { boxes: [fullCanvasBox(hero, 'cover')] })
    } else {
      append('studio-inset', [hero], { boxes: [insetBox(hero, formatId)] })
    }
  }

  // 21:9 等超宽图也横跨书脊，但用全宽完整展示，绝不为了铺满高度切掉两端。
  const panoramas = pool
    .filter((photo) => photo.orientation === 'ultra-wide')
    .sort((a, b) => a._i - b._i)
  for (const panorama of panoramas) {
    pool.splice(pool.indexOf(panorama), 1)
    append('studio-panorama', [panorama], { boxes: [fullCanvasBox(panorama, 'contain')] })
  }

  // 三联跨页只使用同一组竖图；中间画面允许经过书脊，适合没有关键脸部/文字落在正中的照片。
  const portraitPool = pool.filter((photo) => photo.orientation === 'portrait')
  if (portraitPool.length >= 3) {
    const members = portraitPool.slice(0, 3).sort((a, b) => a._i - b._i)
    members.forEach((photo) => pool.splice(pool.indexOf(photo), 1))
    append('studio-triptych', members, {
      boxes: triptychBoxes(members, formatId).map((box) => ({ ...box, fit: 'cover', plate: true })),
    })
  }

  // 剩下的照片按「一个 spread = 两个单页模块」组装：
  // 优先凑三张一跨——一页放一张（挑竖图/超长竖，它们不适合上下拼），
  // 另一页放上下两张（挑横图/方图）。凑不出三张时再退回两人一组。
  const takeOut = (list) => list.forEach((photo) => pool.splice(pool.indexOf(photo), 1))
  while (pool.length >= 3) {
    const single = pool.find(isPortraitish) ?? pool[0]
    const flats = pool.filter((photo) => photo !== single && !isPortraitish(photo))
    const stacked = flats.length >= 2 ? stack2Boxes(flats.slice(0, 2), formatId, 'right') : null
    if (!stacked) break
    const members = [single, ...flats.slice(0, 2)].sort((a, b) => a._i - b._i)
    takeOut([single, ...flats.slice(0, 2)])
    append('studio-mixed', members, {
      boxes: [
        singleBox(single, formatId, 'left'),
        ...stacked,
      ],
    })
  }
  while (pool.length >= 2) {
    const members = pool.splice(0, 2)
    append('studio-pair', members, {
      boxes: [singleBox(members[0], formatId, 'left'), singleBox(members[1], formatId, 'right')],
    })
  }
  if (pool.length === 1) append('studio-title-photo', pool.splice(0, 1))

  void rng // 种子暂时不用：随机排版是下一步（准入 + 分组 + 洗牌 + 节奏）

  return [
    { type: 'cover', layoutId: 'cover', imageIds: [] },
    ...pages,
    { type: 'back', layoutId: 'back', imageIds: [] },
  ]
}

// 各方向可用的单图页版式。超长/超宽图只在能完整展示的版式中出现。
// 竖图的节奏主力是 上顶/下顶/居中（V0.5 排版语言：竖图优先单独成页）。
const SINGLE_LAYOUTS_BY_ORIENTATION = {
  landscape: ['single-center', 'single-small', 'single-offset', 'single-full', 'single-top', 'single-bottom'],
  square: ['single-center', 'single-small', 'single-offset', 'single-full', 'single-top', 'single-bottom'],
  portrait: ['single-center', 'single-small', 'single-offset', 'single-full', 'single-top', 'single-bottom'],
  'ultra-tall': ['single-center', 'single-offset', 'single-top', 'single-bottom'],
  'ultra-wide': ['single-center'],
}

const isPortraitish = (p) => p.orientation === 'portrait' || p.orientation === 'ultra-tall'
const isWideish = (p) => !isPortraitish(p)
const area = (p) => p.width * p.height

function pickWeighted(rng, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [key, w] of entries) {
    r -= w
    if (r < 0) return key
  }
  return entries[entries.length - 1][0]
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

// ---------- 三图页 ----------

function makeTriples(pool, count) {
  const pages = []
  const rest = [...pool]
  for (let i = 0; i < count && rest.length >= 3; i++) {
    const members = []
    while (members.length < 3 && rest.length > 0) {
      // 优先收编超宽图，其次横图/方图
      const uw = rest.findIndex((p) => p.orientation === 'ultra-wide')
      const idx = uw >= 0 ? uw : rest.findIndex(isWideish)
      members.push(rest.splice(idx >= 0 ? idx : 0, 1)[0])
    }
    if (members.length < 3) break

    let layoutId
    let imageIds
    if (members.every(isWideish)) {
      layoutId = 'triple-row'
      imageIds = members
        .sort((a, b) => a._i - b._i)
        .map((m) => m.id)
    } else {
      layoutId = 'triple-dominant'
      // 主位给超长/超宽图，否则给面积最大的
      const domIdx = members.findIndex(
        (p) => p.orientation === 'ultra-wide' || p.orientation === 'ultra-tall',
      )
      const bigIdx =
        domIdx >= 0
          ? domIdx
          : members.reduce((bi, p, j) => (area(p) > area(members[bi]) ? j : bi), 0)
      imageIds = members
        .sort((a, b) => (a === members[bigIdx] ? -1 : b === members[bigIdx] ? 1 : a._i - b._i))
        .map((m) => m.id)
    }
    pages.push({ type: 'triple', layoutId, imageIds })
  }
  return { pages, rest }
}

// ---------- 双图页 ----------

// V0.5 排版语言：双图页只由横图/方图对构成（上下排，double-stack）。
// 竖图优先单独成页（上顶/下顶/居中），不再两张竖图并排拼双图页；
// 混合对（一横一竖）也拆回单图页，保持规则简单可预期。
function makeDoubles(pool, count) {
  const pages = []
  const rest = [...pool]
  while (pages.length < count && rest.length >= 2) {
    const wides = rest.filter(isWideish)
    if (wides.length < 2) break // 只剩竖图（或不足一对横图）：竖图留给单图页
    const pair = wides
      .slice(0, 2)
      .sort((p, q) => p._i - q._i)
    rest.splice(rest.indexOf(pair[0]), 1)
    rest.splice(rest.indexOf(pair[1]), 1)
    pages.push({
      type: 'double',
      layoutId: 'double-stack', // 两张横图上下排
      imageIds: pair.map((p) => p.id),
    })
  }
  return { pages, rest }
}

// ---------- 单图页 ----------

function makeSingles(pool, opener, params, rng, formatId) {
  const rest = [...pool].sort((a, b) => a._i - b._i)
  const ordered = [opener, ...rest]

  const pages = []
  let flip = rng() < 0.5
  let prevBase = null

  for (const photo of ordered) {
    const allowed = (SINGLE_LAYOUTS_BY_ORIENTATION[photo.orientation] ?? ['single-center']).filter(
      (layoutId) => layoutId !== 'single-full' || isFullBleedCompatible(photo, formatId),
    )
    let base
    if (photo === opener) {
      base = allowed.includes(params.opener) ? params.opener : 'single-center'
    } else {
      const entries = Object.entries(params.singles).filter(([k, w]) => allowed.includes(k) && w > 0)
      const usable = entries.length > 1 ? entries.filter(([k]) => k !== prevBase) : entries
      base = pickWeighted(rng, usable.length ? usable : [['single-center', 1]])
    }
    prevBase = base

    const layoutId =
      base === 'single-offset' ? `single-offset-${flip ? 'left' : 'right'}` : base
    if (base === 'single-offset') flip = !flip
    pages.push({ type: 'single', layoutId, imageIds: [photo.id] })
  }
  return pages
}

// ---------- 节奏编排 ----------

function interleave(singles, multis, gap, rng) {
  const content = []
  let si = 0
  let mi = 0
  while (si < singles.length) {
    let emit = randInt(rng, gap[0], gap[1])
    while (emit-- > 0 && si < singles.length) content.push(singles[si++])
    if (mi < multis.length) content.push(multis[mi++])
  }
  while (mi < multis.length) content.push(multis[mi++])
  return content
}

// ---------- 主入口 ----------

export function planPages(photos, style = 'gallery', seed = 1, formatId = 'portrait') {
  if (!Array.isArray(photos) || photos.length < MIN_PHOTOS || photos.length > MAX_PHOTOS) {
    throw new Error(`planPages 需要 ${MIN_PHOTOS}–${MAX_PHOTOS} 张图片`)
  }
  if (style === 'studio') return planStudioPages(photos, seed, formatId)
  const params = STYLE_PARAMS[style]
  if (!params) throw new Error(`未知风格：${style}`)

  const n = photos.length
  const tier = n <= 7 ? 'small' : n <= 12 ? 'mid' : 'large'
  const rng = mulberry32(hashSeed(String(seed)))

  // 目标页面构成；若单图页不足 3 页则削减多图页
  const [dMin, dMax] = params.doublesByTier[tier]
  let d = randInt(rng, dMin, dMax)
  let t = params.triplesByTier[tier]
  while (n - 2 * d - 3 * t < 3 && d > dMin) d--
  while (n - 2 * d - 3 * t < 3 && t > 0) t--

  const withIndex = photos.map((p, i) => ({ ...p, _i: i }))
  // 开篇页：面积最大的照片先锁定为主视觉，不参与多图页分配
  const opener = withIndex.reduce((best, p) => (area(p) > area(best) ? p : best), withIndex[0])
  const pool = withIndex.filter((p) => p !== opener)
  const { pages: triples, rest: afterTriples } = makeTriples(pool, t)
  const { pages: doubles, rest: singlesPool } = makeDoubles(afterTriples, d)
  const singles = makeSingles(singlesPool, opener, params, rng, formatId)

  const content = interleave(singles, [...doubles, ...triples], params.gap, rng)

  return [
    { type: 'cover', layoutId: 'cover', imageIds: [] },
    ...content,
    { type: 'back', layoutId: 'back', imageIds: [] },
  ]
}
