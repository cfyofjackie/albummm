import { useEffect, useRef, useState } from 'react'
import { makeDemoPhotos } from '../lib/demo.js'
import { loadPhoto } from '../lib/photo.js'
import './CarouselMastersPrototype.css'
import './CarouselScatterPrototype.css'

// PROTOTYPE — Can a seeded, geometry-only loose layout preserve photo ratios
// while allowing small paper-card overlaps? Open /?prototype=carousel-scatter.

const FRAME_ASPECT = .8 // 4:5 output pages
const EXPORT_WIDTH = 1080
const EXPORT_HEIGHT = 1350
// 当前验证已确定的视觉边界：限制照片内容，不限制带白边的外卡片。
const SIZE_RULES = { minShortEdge: .2, maxContentWidth: .8, maxContentHeight: .78 }

// 用户选择风格；随机的位置、尺寸与轻叠只是各风格内部的排版规则。
const STYLES = [
  { id: 'gallery', label: '01', name: 'Gallery', overlap: 0, rotation: 0, overlapChance: 0, anchorShort: .47, fragmentRange: .1, maxOverlaps: 0, note: '安静纸面 · 规整留白 · 照片完整呈现。' },
  { id: 'muse', label: '02', name: 'Muse', overlap: .08, rotation: .45, overlapChance: .45, anchorShort: .43, fragmentRange: .14, maxOverlaps: 1, note: '柔和色带 · 轻微错位 · 更有 editorial 感。' },
  { id: 'weekend', label: '03', name: 'Weekend', overlap: .16, rotation: 1.8, overlapChance: .68, anchorShort: .41, fragmentRange: .18, maxOverlaps: 1, note: '网格片段 · 节奏更快 · 可以有少量轻叠。' },
]
const LEGACY_STYLE_BY_STRATEGY = { edge: 'gallery', soft: 'muse', cluster: 'weekend' }

// PROTOTYPE — Three five-page rhythm recipes on /?prototype=carousel-rhythm.
// They set page-level emphasis only; the final position of every photo stays seeded-random.
const RHYTHMS = {
  gallery: [
    { id: 'pair', label: '双图关系', anchorShort: .37, fragmentBase: .22, fragmentRange: .06 },
    { id: 'cluster', label: '片段组合', anchorShort: .32, fragmentBase: .2, fragmentRange: .07 },
    { id: 'pair', label: '双图关系', anchorShort: .37, fragmentBase: .22, fragmentRange: .06 },
    { id: 'cluster', label: '片段组合', anchorShort: .32, fragmentBase: .2, fragmentRange: .07 },
    { id: 'pair', label: '双图收束', anchorShort: .36, fragmentBase: .22, fragmentRange: .06 },
  ],
  muse: [
    { id: 'pair', label: '不对称双图', anchorShort: .38, fragmentBase: .23, fragmentRange: .07 },
    { id: 'cluster', label: '片段组合', anchorShort: .33, fragmentBase: .2, fragmentRange: .08 },
    { id: 'pair', label: '双图关系', anchorShort: .38, fragmentBase: .23, fragmentRange: .07 },
    { id: 'cluster', label: '片段组合', anchorShort: .33, fragmentBase: .2, fragmentRange: .08 },
    { id: 'pair', label: '双图收束', anchorShort: .37, fragmentBase: .22, fragmentRange: .07 },
  ],
  weekend: [
    { id: 'cluster', label: '片段开场', anchorShort: .33, fragmentBase: .2, fragmentRange: .09 },
    { id: 'pair', label: '两图关系', anchorShort: .38, fragmentBase: .23, fragmentRange: .08 },
    { id: 'cluster', label: '片段高点', anchorShort: .33, fragmentBase: .2, fragmentRange: .1 },
    { id: 'pair', label: '双图停顿', anchorShort: .37, fragmentBase: .22, fragmentRange: .08 },
    { id: 'cluster', label: '片段收束', anchorShort: .32, fragmentBase: .2, fragmentRange: .08 },
  ],
}

function rngFrom(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const area = (box) => box.w * box.h

function intersection(a, b) {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return w * h
}

function physicalShortEdge(box) {
  return Math.min(box.w, box.h / FRAME_ASPECT)
}

function matFor(box) {
  // 以 1080×1350 导出画布估算：小卡片 2px，大卡片最多 5px。
  return clamp(Math.round(physicalShortEdge(box) * EXPORT_WIDTH * .015), 2, 5)
}

function innerBox(box) {
  const mat = matFor(box)
  const insetX = mat / EXPORT_WIDTH
  const insetY = mat / EXPORT_HEIGHT
  return { x: box.x + insetX, y: box.y + insetY, w: box.w - insetX * 2, h: box.h - insetY * 2 }
}

function sizeFor(photo, isAnchor, random, style, recipe = null) {
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

function candidateFor(photo, isAnchor, random, style, anchor = null, recipe = null) {
  const { w, h } = sizeFor(photo, isAnchor, random, style, recipe)
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

function fallbackFor(photo, index, style, recipe) {
  const { w, h } = sizeFor(photo, index === 0, () => .5, style, recipe)
  return { x: .1 + index * .08, y: .12 + index * .12, w, h, rotate: 0 }
}

function safeFallback(photo, index, placed, style, recipe) {
  const base = fallbackFor(photo, index, style, recipe)
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

function placeFrame(photos, random, style, recipe = null) {
  const placed = []
  const unplaced = []
  let rejected = 0
  let overlaps = 0
  photos.forEach((photo, index) => {
    let chosen = null
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = candidateFor(photo, placed.length === 0, random, style, placed[0], recipe)
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
      const fallback = safeFallback(photo, index, placed, style, recipe)
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

function capacityFor(recipe) {
  return recipe ? 2 : 1
}

function overflowRecipeFor(recipes) {
  return recipes?.find((recipe) => recipe.id === 'cluster') ?? {
    id: 'cluster', label: '片段补充', anchorShort: .38, fragmentBase: .24, fragmentRange: .1,
  }
}

function groupsFor(photos, recipes = null) {
  if (recipes) {
    const remaining = [...photos]
    const frames = recipes.map((recipe) => ({
      photos: remaining.splice(0, capacityFor(recipe)),
      recipe,
    })).filter((frame) => frame.photos.length)
    const overflowRecipe = overflowRecipeFor(recipes)
    while (remaining.length) {
      frames.push({ photos: remaining.splice(0, capacityFor(overflowRecipe)), recipe: overflowRecipe })
    }
    return frames
  }
  const frames = Array.from({ length: 5 }, () => ({ photos: [], recipe: null }))
  photos.forEach((photo, index) => {
    const frame = Math.min(4, Math.floor(index * 5 / photos.length))
    frames[frame].photos.push(photo)
  })
  return frames
}

function planStory(photos, seed, style, rhythm = false) {
  const random = rngFrom(seed)
  const frames = []
  let pending = []
  const recipes = rhythm ? RHYTHMS[style.id] : null
  groupsFor(photos, recipes).forEach(({ photos: group, recipe }) => {
    const frame = placeFrame(rhythm ? group : [...pending, ...group], random, style, recipe)
    frames.push({ ...frame, recipe })
    if (rhythm) {
      let overflow = frame.unplaced
      const overflowRecipe = overflowRecipeFor(recipes)
      while (overflow.length) {
        const overflowFrame = placeFrame(overflow, random, style, overflowRecipe)
        frames.push({ ...overflowFrame, recipe: overflowRecipe })
        if (!overflowFrame.placed.length) {
          frames.push({ ...placeFrame([overflow[0]], random, style, overflowRecipe), recipe: overflowRecipe })
          overflow = overflow.slice(1)
        } else {
          overflow = overflowFrame.unplaced
        }
      }
    } else {
      pending = frame.unplaced
    }
  })
  while (pending.length) {
    const recipe = frames.at(-1)?.recipe ?? recipes?.[recipes.length - 1] ?? null
    const frame = placeFrame(pending, random, style, recipe)
    if (!frame.placed.length) {
      // 极端比例也必须保留完整展示：单独占一页，而不是突破最小尺度。
      frames.push({ ...placeFrame([pending[0]], random, style, recipe), recipe })
      pending = pending.slice(1)
    } else {
      frames.push({ ...frame, recipe })
      pending = frame.unplaced
    }
  }
  return {
    frames,
    rejected: frames.reduce((sum, frame) => sum + frame.rejected, 0),
    overlaps: frames.reduce((sum, frame) => sum + frame.overlaps, 0),
    contentCollisions: frames.reduce((sum, frame) => sum + frame.contentCollisions, 0),
  }
}

function ScatterFrame({ frame, index, rhythm }) {
  return (
    <article className={`carousel-master__frame scatter-frame ${rhythm && frame.recipe ? `rhythm-frame rhythm-frame--${frame.recipe.id}` : ''}`}>
      <span className="carousel-master__number">{String(index + 1).padStart(2, '0')}</span>
      {rhythm && frame.recipe && <span className="rhythm-frame__role">{frame.recipe.label}</span>}
      {frame.placed.map(({ photo, x, y, w, h, rotate }) => (
        <figure
          key={photo.id}
          className="carousel-master__photo scatter-card"
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, rotate: `${rotate}deg`, '--scatter-mat': `${matFor({ w, h })}px` }}
        >
          <img src={photo.previewSrc} alt="随机排版中的照片" />
        </figure>
      ))}
    </article>
  )
}

function StyleSwitcher({ activeId, onChange }) {
  const index = STYLES.findIndex((style) => style.id === activeId)
  const previous = STYLES[(index - 1 + STYLES.length) % STYLES.length]
  const next = STYLES[(index + 1) % STYLES.length]
  const active = STYLES[index]
  return (
    <nav className="carousel-master__switcher" aria-label="切换视觉风格">
      <button type="button" onClick={() => onChange(previous.id)} aria-label="上一个风格">←</button>
      <span>{active.label} · {active.name}</span>
      <button type="button" onClick={() => onChange(next.id)} aria-label="下一个风格">→</button>
    </nav>
  )
}

export default function CarouselScatterPrototype({ rhythm = false }) {
  const params = new URLSearchParams(window.location.search)
  const requestedStyle = LEGACY_STYLE_BY_STRATEGY[params.get('variant')] ?? params.get('variant')
  const initial = STYLES.some((style) => style.id === requestedStyle) ? requestedStyle : 'gallery'
  const [activeId, setActiveId] = useState(initial)
  const [photos, setPhotos] = useState([])
  const [seed, setSeed] = useState(4128)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef(null)
  const style = STYLES.find((item) => item.id === activeId)

  useEffect(() => {
    let live = true
    makeDemoPhotos(10).then((demo) => {
      if (!live) return
      setPhotos(demo)
      setLoading(false)
    })
    return () => { live = false }
  }, [])

  const changeStyle = (id) => {
    const next = new URLSearchParams(window.location.search)
    next.set('prototype', rhythm ? 'carousel-rhythm' : 'carousel-scatter')
    next.set('variant', id)
    window.history.replaceState(null, '', `?${next.toString()}`)
    setActiveId(id)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target.matches('input, textarea, [contenteditable="true"]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = STYLES.findIndex((item) => item.id === activeId)
      changeStyle(STYLES[event.key === 'ArrowLeft' ? (index + 2) % 3 : (index + 1) % 3].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeId])

  const addPhotos = async (event) => {
    const files = [...event.target.files].filter((file) => file.type.startsWith('image/')).slice(0, 15)
    if (!files.length) return
    setLoading(true)
    setPhotos(await Promise.all(files.map(loadPhoto)))
    setSeed(Math.floor(Math.random() * 1e9))
    setLoading(false)
    event.target.value = ''
  }

  const story = photos.length ? planStory(photos, seed, style, rhythm) : null
  return (
    <main className={`carousel-master scatter-prototype ${rhythm ? 'rhythm-prototype' : ''} scatter-prototype--${activeId}`}>
      <header className="carousel-master__header">
        <div>
          <p>PROTOTYPE · V3 {rhythm ? '五页基准节奏' : '受控随机片段'}</p>
          <h1>{style.name}</h1>
          <span>{style.note}</span>
        </div>
        <div className="carousel-master__actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
          <button type="button" onClick={() => inputRef.current?.click()}>换一组照片</button>
          <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>换一组排法</button>
        </div>
      </header>

      <section className="scatter-prototype__state" aria-label="排版状态">
        <span>seed {seed}</span>
        <span>内容短边 ≥ 20%</span>
        <span>横 ≤ 80% · 竖 ≤ 78%</span>
        <span>外层卡片覆盖 ≤ {Math.round(style.overlap * 100)}%</span>
        <span>照片内容区碰撞 {story?.contentCollisions ?? 0}</span>
        <span>{story ? `已拒绝 ${story.rejected} 个候选位置 · 接受 ${story.overlaps} 处轻叠` : '正在计算'}</span>
        {rhythm && story && <span>{story.frames.length} 页输出</span>}
        {rhythm && story && <span>节奏：{story.frames.slice(0, 5).map((frame) => frame.recipe?.label).filter(Boolean).join(' → ')}</span>}
      </section>

      <section className="carousel-master__stage" aria-label={rhythm ? '五页节奏连续作品预览' : '五页随机连续作品预览'}>
        {loading || !story ? <p className="carousel-master__loading">正在计算卡片位置…</p> : (
          <div className="carousel-master__strip scatter-strip" style={{ '--scatter-page-count': story.frames.length }}>
            {story.frames.map((frame, index) => <ScatterFrame key={index} frame={frame} index={index} rhythm={rhythm} />)}
          </div>
        )}
      </section>

      <aside className="carousel-master__rules">
        <span>本轮验证</span>
        <p>{rhythm
          ? '这一版只规定每页承担的观看角色；照片的具体位置、尺寸与轻叠仍由种子随机决定。请判断它是否让整组更有起伏，而没有牺牲当前的自由感。'
          : '随机位置只能在已确定的内容尺寸范围内移动；放不下的照片自动顺延到下一页。白边是更细的装裱边，也是保护照片内容的碰撞缓冲区。'}
        </p>
      </aside>
      <StyleSwitcher activeId={activeId} onChange={changeStyle} />
    </main>
  )
}
