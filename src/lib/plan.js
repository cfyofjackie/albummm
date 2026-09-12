// 排版引擎：photos + style + seed → pages[]
// 纯函数，无 DOM 依赖。
//
// 策略（见 SLC.md 五、六）：
// - 单图页为主，多图页为亮点；每页最多 3 张
// - 图片方向驱动模板选择：竖图 → 偏置单图/左右双图；横图 → 大单图/上下双图；
//   超长图优先收编进三图页，避免在 4:5 页内大面积留白
// - 数量分档：5–7 以单图为主（至多 1 个双图页）；8–12 单双混排（至多 1 个三图页）；
//   13–20 增加双图页比例，仍保留单图页维持节奏
// - 可 seed 伪随机：同 seed 结果一致，换 seed 重新生成

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

function makeSingles(pool, opener, params, rng) {
  const rest = [...pool].sort((a, b) => a._i - b._i)
  const ordered = [opener, ...rest]

  const pages = []
  let flip = rng() < 0.5
  let prevBase = null

  for (const photo of ordered) {
    const allowed = SINGLE_LAYOUTS_BY_ORIENTATION[photo.orientation] ?? ['single-center']
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

export function planPages(photos, style = 'gallery', seed = 1) {
  if (!Array.isArray(photos) || photos.length < MIN_PHOTOS || photos.length > MAX_PHOTOS) {
    throw new Error(`planPages 需要 ${MIN_PHOTOS}–${MAX_PHOTOS} 张图片`)
  }
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
  const singles = makeSingles(singlesPool, opener, params, rng)

  const content = interleave(singles, [...doubles, ...triples], params.gap, rng)

  return [
    { type: 'cover', layoutId: 'cover', imageIds: [] },
    ...content,
    { type: 'back', layoutId: 'back', imageIds: [] },
  ]
}
