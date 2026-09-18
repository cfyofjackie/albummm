import { useEffect, useRef, useState } from 'react'
import { makeDemoPhotos } from '../lib/demo.js'
import { loadPhoto } from '../lib/photo.js'
import './CarouselMastersPrototype.css'
import './CarouselScalePrototype.css'

// PROTOTYPE — Can we agree on a readable min/max photo scale before placing
// photos randomly? Open /?prototype=carousel-scale&variant=balanced.

const VARIANTS = [
  { id: 'compact', label: '01', name: '紧凑', min: 13, maxWidth: 76, maxHeight: 74, note: '碎片更多，整体更轻。' },
  { id: 'balanced', label: '02', name: '平衡', min: 15, maxWidth: 80, maxHeight: 78, note: '让小图可读，也为大图留出呼吸。' },
  { id: 'generous', label: '03', name: '舒展', min: 17, maxWidth: 84, maxHeight: 82, note: '照片更有存在感，留给碎片的空间更少。' },
]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function byShape(photos, predicate) {
  return photos.find(predicate) ?? photos[0]
}

function ScaleCard({ photo, size, label, detail, position, scale }) {
  const aspect = photo.width / photo.height
  const isPortrait = aspect < .88
  const isLandscape = aspect > 1.12
  let width = size === 'min' ? scale.min : scale.maxWidth
  if (size === 'max' && isPortrait) width = scale.maxHeight * aspect / .8
  if (size === 'min' && isLandscape) width = scale.min * aspect
  width = clamp(width, 10, 90)
  return (
    <figure
      className={`scale-card scale-card--${size}`}
      style={{ ...position, width: `${width}%` }}
    >
      <img src={photo.previewSrc} alt={`${label}示例`} />
      <figcaption>
        <strong>{label}</strong>
        <span>{detail}</span>
      </figcaption>
    </figure>
  )
}

function ScaleFrame({ type, shape, scale, photos }) {
  const portrait = byShape(photos, (photo) => photo.width / photo.height < .88)
  const square = byShape(photos, (photo) => {
    const aspect = photo.width / photo.height
    return aspect >= .88 && aspect <= 1.12
  })
  const landscape = byShape(photos, (photo) => photo.width / photo.height > 1.12)
  const isMin = type === 'min'
  const maxPhoto = shape === 'portrait' ? portrait : landscape
  const maxLabel = shape === 'portrait' ? '最大竖图' : '最大横图'
  const maxDetail = shape === 'portrait'
    ? `内容高 ≤ 页面高 ${scale.maxHeight}%`
    : `内容宽 ≤ 页面宽 ${scale.maxWidth}%`
  return (
    <article className={`scale-frame scale-frame--${type}`}>
      <header>
        <span>{isMin ? '最小图' : maxLabel}</span>
        <p>{isMin
          ? `内容短边 ≥ 页面短边 ${scale.min}%`
          : maxDetail}
        </p>
      </header>
      <div className="scale-frame__page">
        {isMin ? (
          <>
            <ScaleCard photo={portrait} size="min" scale={scale} label="竖图" detail={`短边 ${scale.min}%`} position={{ left: '14%', top: '18%' }} />
            <ScaleCard photo={square} size="min" scale={scale} label="方图" detail={`短边 ${scale.min}%`} position={{ right: '15%', top: '43%' }} />
            <ScaleCard photo={landscape} size="min" scale={scale} label="横图" detail={`短边 ${scale.min}%`} position={{ left: '25%', bottom: '15%' }} />
          </>
        ) : <ScaleCard
          photo={maxPhoto}
          size="max"
          scale={scale}
          label={shape === 'portrait' ? '竖图' : '横图'}
          detail={shape === 'portrait' ? `高 ${scale.maxHeight}%` : `宽 ${scale.maxWidth}%`}
          position={shape === 'portrait' ? { left: '17.5%', top: '9%' } : { left: '8%', top: '27%' }}
        />}
      </div>
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
    <nav className="carousel-master__switcher" aria-label="切换尺寸范围">
      <button type="button" onClick={() => onChange(previous.id)} aria-label="上一个尺寸范围">←</button>
      <span>{active.label} · {active.name}</span>
      <button type="button" onClick={() => onChange(next.id)} aria-label="下一个尺寸范围">→</button>
    </nav>
  )
}

export default function CarouselScalePrototype() {
  const params = new URLSearchParams(window.location.search)
  const initial = VARIANTS.some((variant) => variant.id === params.get('variant')) ? params.get('variant') : 'balanced'
  const [activeId, setActiveId] = useState(initial)
  const [photos, setPhotos] = useState([])
  const inputRef = useRef(null)
  const scale = VARIANTS.find((variant) => variant.id === activeId)

  useEffect(() => {
    makeDemoPhotos(10).then(setPhotos)
  }, [])

  const changeVariant = (id) => {
    const next = new URLSearchParams(window.location.search)
    next.set('prototype', 'carousel-scale')
    next.set('variant', id)
    window.history.replaceState(null, '', `?${next.toString()}`)
    setActiveId(id)
  }

  const addPhotos = async (event) => {
    const files = [...event.target.files].filter((file) => file.type.startsWith('image/')).slice(0, 12)
    if (!files.length) return
    setPhotos(await Promise.all(files.map(loadPhoto)))
    event.target.value = ''
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target.matches('input, textarea, [contenteditable="true"]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = VARIANTS.findIndex((variant) => variant.id === activeId)
      changeVariant(VARIANTS[event.key === 'ArrowLeft' ? (index + 2) % 3 : (index + 1) % 3].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeId])

  return (
    <main className="carousel-master scale-prototype">
      <header className="carousel-master__header">
        <div>
          <p>PROTOTYPE · V3 图片尺寸标尺</p>
          <h1>{scale.name}</h1>
          <span>{scale.note}</span>
        </div>
        <div className="carousel-master__actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
          <button type="button" onClick={() => inputRef.current?.click()}>换一组照片</button>
        </div>
      </header>

      <section className="scale-prototype__state" aria-label="当前尺寸规则">
        <span>最小内容短边 {scale.min}%</span>
        <span>横图最大宽 {scale.maxWidth}%</span>
        <span>竖图最大高 {scale.maxHeight}%</span>
        <span>白边 2–5px，随卡片尺寸变化</span>
      </section>

      {photos.length ? (
        <section className="scale-prototype__comparison" aria-label="最小与最大照片尺寸对照">
          <ScaleFrame type="min" scale={scale} photos={photos} />
          <ScaleFrame type="max" shape="portrait" scale={scale} photos={photos} />
          <ScaleFrame type="max" shape="landscape" scale={scale} photos={photos} />
        </section>
      ) : <p className="carousel-master__loading">正在准备尺寸样张…</p>}

      <aside className="carousel-master__rules">
        <span>本轮验证</span>
        <p>先定照片内容的可读范围；随机排版只能在这个范围内移动和缩放。最小图如果放不下，应换页，而不是继续缩小。</p>
      </aside>
      <Switcher activeId={activeId} onChange={changeVariant} />
    </main>
  )
}
