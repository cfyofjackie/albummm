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
const SIZE_RULES = { minShortEdge: .15, maxContentWidth: .8, maxContentHeight: .78 }

const VARIANTS = [
  { id: 'edge', label: '01', name: '边缘碰触', overlap: 0, rotation: 0, note: '卡片彼此不覆盖；随机只来自位置、大小与留白。' },
  { id: 'soft', label: '02', name: '白边轻叠', overlap: .1, rotation: 1, note: '外层白边可轻叠，真实照片内容区始终不重叠。' },
  { id: 'cluster', label: '03', name: '受控片段', overlap: .16, rotation: 1.8, note: '每页最多两处卡片轻叠，适合 Weekend 的片段段落。' },
]

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

function sizeFor(photo, isAnchor, random) {
  const aspect = photo.width / photo.height
  const desiredShort = isAnchor
    ? .43 + (random() - .5) * .12
    : SIZE_RULES.minShortEdge + random() * .18
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

function candidateFor(photo, isAnchor, random, variant, anchor = null) {
  const { w, h } = sizeFor(photo, isAnchor, random)
  // 有白边时，让辅助卡片偶尔贴着第一张的外缘：视觉上有叠放，
  // 但重叠宽度小于两张白边的总缓冲，内层照片依然不会相撞。
  if (anchor && variant.overlap > 0 && random() < .68) {
    const overlap = .025 + random() * variant.overlap * .42
    const toRight = random() < .5
    return {
      x: clamp(toRight ? anchor.x + anchor.w - w * overlap : anchor.x - w + w * overlap, .07, .93 - w),
      y: clamp(anchor.y + (random() - .5) * Math.min(anchor.h, h) * .45, .11, .91 - h),
      w,
      h,
      rotate: (random() - .5) * variant.rotation * 2,
    }
  }
  return {
    x: .07 + random() * Math.max(.01, .86 - w),
    y: .11 + random() * Math.max(.01, .8 - h),
    w,
    h,
    rotate: (random() - .5) * variant.rotation * 2,
  }
}

function acceptable(box, placed, variant) {
  const inner = innerBox(box)
  let cardOverlaps = 0
  for (const other of placed) {
    const cardRatio = intersection(box, other) / Math.min(area(box), area(other))
    if (cardRatio > variant.overlap) return null
    if (intersection(inner, innerBox(other)) > .0001) return null
    if (cardRatio > 0) cardOverlaps += 1
  }
  if (variant.id === 'cluster' && cardOverlaps > 1) return null
  return cardOverlaps
}

function fallbackFor(photo, index, variant) {
  const { w, h } = sizeFor(photo, index === 0, () => .5)
  return { x: .1 + index * .08, y: .12 + index * .12, w, h, rotate: 0 }
}

function safeFallback(photo, index, placed, variant) {
  const base = fallbackFor(photo, index, variant)
  const grid = [.08, .28, .48, .68]
  for (const y of grid) {
    for (const x of grid) {
      const candidate = { ...base, x: clamp(x, .04, .96 - base.w), y: clamp(y, .06, .94 - base.h) }
      const cardOverlaps = acceptable(candidate, placed, variant)
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

function placeFrame(photos, random, variant) {
  const placed = []
  const unplaced = []
  let rejected = 0
  let overlaps = 0
  photos.forEach((photo, index) => {
    let chosen = null
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = candidateFor(photo, placed.length === 0, random, variant, placed[0])
      const cardOverlaps = acceptable(candidate, placed, variant)
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
      const fallback = safeFallback(photo, index, placed, variant)
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

function groupsFor(photos) {
  const frames = Array.from({ length: 5 }, () => [])
  photos.forEach((photo, index) => {
    const frame = Math.min(4, Math.floor(index * 5 / photos.length))
    frames[frame].push(photo)
  })
  return frames
}

function planStory(photos, seed, variant) {
  const random = rngFrom(seed)
  const frames = []
  let pending = []
  groupsFor(photos).forEach((group) => {
    const frame = placeFrame([...pending, ...group], random, variant)
    frames.push(frame)
    pending = frame.unplaced
  })
  while (pending.length) {
    const frame = placeFrame(pending, random, variant)
    if (!frame.placed.length) {
      // 极端比例也必须保留完整展示：单独占一页，而不是突破最小尺度。
      frames.push(placeFrame([pending[0]], random, variant))
      pending = pending.slice(1)
    } else {
      frames.push(frame)
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

function ScatterFrame({ frame, index, variant }) {
  return (
    <article className="carousel-master__frame scatter-frame">
      <span className="carousel-master__number">{String(index + 1).padStart(2, '0')}</span>
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

function Switcher({ activeId, onChange }) {
  const index = VARIANTS.findIndex((variant) => variant.id === activeId)
  const previous = VARIANTS[(index - 1 + VARIANTS.length) % VARIANTS.length]
  const next = VARIANTS[(index + 1) % VARIANTS.length]
  const active = VARIANTS[index]
  if (!import.meta.env.DEV) return null
  return (
    <nav className="carousel-master__switcher" aria-label="切换随机策略">
      <button type="button" onClick={() => onChange(previous.id)} aria-label="上一个策略">←</button>
      <span>{active.label} · {active.name}</span>
      <button type="button" onClick={() => onChange(next.id)} aria-label="下一个策略">→</button>
    </nav>
  )
}

export default function CarouselScatterPrototype() {
  const params = new URLSearchParams(window.location.search)
  const initial = VARIANTS.some((variant) => variant.id === params.get('variant')) ? params.get('variant') : 'soft'
  const [activeId, setActiveId] = useState(initial)
  const [photos, setPhotos] = useState([])
  const [seed, setSeed] = useState(4128)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef(null)
  const variant = VARIANTS.find((item) => item.id === activeId)

  useEffect(() => {
    let live = true
    makeDemoPhotos(10).then((demo) => {
      if (!live) return
      setPhotos(demo)
      setLoading(false)
    })
    return () => { live = false }
  }, [])

  const changeVariant = (id) => {
    const next = new URLSearchParams(window.location.search)
    next.set('prototype', 'carousel-scatter')
    next.set('variant', id)
    window.history.replaceState(null, '', `?${next.toString()}`)
    setActiveId(id)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target.matches('input, textarea, [contenteditable="true"]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = VARIANTS.findIndex((item) => item.id === activeId)
      changeVariant(VARIANTS[event.key === 'ArrowLeft' ? (index + 2) % 3 : (index + 1) % 3].id)
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

  const story = photos.length ? planStory(photos, seed, variant) : null
  return (
    <main className={`carousel-master scatter-prototype scatter-prototype--${activeId}`}>
      <header className="carousel-master__header">
        <div>
          <p>PROTOTYPE · V3 受控随机片段</p>
          <h1>{variant.name}</h1>
          <span>{variant.note}</span>
        </div>
        <div className="carousel-master__actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
          <button type="button" onClick={() => inputRef.current?.click()}>换一组照片</button>
          <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>换一组排法</button>
        </div>
      </header>

      <section className="scatter-prototype__state" aria-label="排版状态">
        <span>seed {seed}</span>
        <span>内容短边 ≥ 15%</span>
        <span>横 ≤ 80% · 竖 ≤ 78%</span>
        <span>外层卡片覆盖 ≤ {Math.round(variant.overlap * 100)}%</span>
        <span>照片内容区碰撞 {story?.contentCollisions ?? 0}</span>
        <span>{story ? `已拒绝 ${story.rejected} 个候选位置 · 接受 ${story.overlaps} 处轻叠` : '正在计算'}</span>
      </section>

      <section className="carousel-master__stage" aria-label="五页随机连续作品预览">
        {loading || !story ? <p className="carousel-master__loading">正在计算卡片位置…</p> : (
          <div className="carousel-master__strip scatter-strip" style={{ '--scatter-page-count': story.frames.length }}>
            {story.frames.map((frame, index) => <ScatterFrame key={index} frame={frame} index={index} variant={variant} />)}
          </div>
        )}
      </section>

      <aside className="carousel-master__rules">
        <span>本轮验证</span>
        <p>随机位置只能在已确定的内容尺寸范围内移动；放不下的照片自动顺延到下一页。白边是更细的装裱边，也是保护照片内容的碰撞缓冲区。</p>
      </aside>
      <Switcher activeId={activeId} onChange={changeVariant} />
    </main>
  )
}
