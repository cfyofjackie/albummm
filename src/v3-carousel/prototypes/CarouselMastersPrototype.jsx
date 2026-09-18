import { useEffect, useRef, useState } from 'react'
import { makeDemoPhotos } from '../../shared/demo.js'
import { loadPhoto } from '../../shared/photo.js'
import './CarouselMastersPrototype.css'

// PROTOTYPE — Which five-frame visual system best turns mixed photo ratios
// into a coherent carousel? Open /?prototype=carousel-masters&variant=gallery.

const VARIANTS = [
  {
    id: 'gallery',
    label: '01',
    name: 'Gallery · 安静画布',
    note: '同一张淡网格纸上，让图片以留白和尺度差形成节奏。',
    frames: [
      [{ role: 'any', x: 14, y: 16, w: 62 }],
      [{ role: 'landscape', x: 10, y: 15, w: 72 }, { role: 'square', x: 61, y: 58, w: 25 }],
      [{ role: 'portrait', x: 35, y: 12, w: 34 }],
      [{ role: 'landscape', x: 8, y: 36, w: 84 }],
      [{ role: 'portrait', x: 10, y: 14, w: 27 }, { role: 'square', x: 48, y: 23, w: 27 }, { role: 'landscape', x: 38, y: 62, w: 46 }],
    ],
  },
  {
    id: 'muse',
    label: '02',
    name: 'Muse · 柔和编辑',
    note: '色块先连接五页，照片以不对称的对照关系进入画面。',
    frames: [
      [{ role: 'portrait', x: 12, y: 18, w: 35 }, { role: 'square', x: 55, y: 32, w: 29 }],
      [{ role: 'landscape', x: 11, y: 15, w: 76 }, { role: 'portrait', x: 63, y: 54, w: 23 }],
      [{ role: 'portrait', x: 36, y: 10, w: 34 }, { role: 'square', x: 13, y: 62, w: 25 }],
      [{ role: 'any', x: 18, y: 27, w: 65 }],
      [{ role: 'square', x: 11, y: 16, w: 31 }, { role: 'portrait', x: 54, y: 14, w: 27 }, { role: 'landscape', x: 12, y: 67, w: 67 }],
    ],
  },
  {
    id: 'weekend',
    label: '03',
    name: 'Weekend · 受控片段',
    note: '更快的节奏、更多碎片；但仍由同一网格和背景收住。',
    frames: [
      [{ role: 'square', x: 10, y: 16, w: 31, rotate: -1.4 }, { role: 'portrait', x: 47, y: 12, w: 29, rotate: .8 }, { role: 'landscape', x: 17, y: 63, w: 54, rotate: -.6 }],
      [{ role: 'landscape', x: 9, y: 15, w: 79, rotate: .4 }, { role: 'square', x: 59, y: 57, w: 26, rotate: -1.1 }],
      [{ role: 'portrait', x: 12, y: 14, w: 29, rotate: -.8 }, { role: 'portrait', x: 55, y: 27, w: 27, rotate: 1.2 }],
      [{ role: 'square', x: 13, y: 21, w: 26, rotate: .7 }, { role: 'landscape', x: 29, y: 48, w: 59, rotate: -.5 }],
      [{ role: 'portrait', x: 10, y: 14, w: 24, rotate: -1 }, { role: 'square', x: 41, y: 18, w: 24, rotate: .8 }, { role: 'landscape', x: 23, y: 61, w: 62, rotate: -.3 }],
    ],
  },
]

function aspectOf(photo) {
  return photo.width / photo.height
}

function targetAspect(role) {
  if (role === 'portrait') return .7
  if (role === 'landscape') return 1.55
  if (role === 'square') return 1
  return 1.15
}

function assignPhotos(photos, frames) {
  const pool = [...photos]
  let fallback = 0
  return frames.map((frame) => frame.map((slot) => {
    if (!pool.length) {
      const photo = photos[fallback % photos.length]
      fallback += 1
      return { ...slot, photo }
    }
    const target = targetAspect(slot.role)
    const bestIndex = pool.reduce((best, photo, index) => (
      Math.abs(Math.log(aspectOf(photo) / target)) < Math.abs(Math.log(aspectOf(pool[best]) / target))
        ? index : best
    ), 0)
    return { ...slot, photo: pool.splice(bestIndex, 1)[0] }
  }))
}

function StoryFrame({ frame, index }) {
  return (
    <article className="carousel-master__frame">
      <span className="carousel-master__number">{String(index + 1).padStart(2, '0')}</span>
      {frame.map(({ photo, x, y, w, rotate = 0 }, pieceIndex) => (
        <figure
          key={`${photo.id}-${pieceIndex}`}
          className="carousel-master__photo"
          style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, rotate: `${rotate}deg` }}
        >
          <img src={photo.previewSrc} alt="演示照片" />
        </figure>
      ))}
    </article>
  )
}

function PrototypeSwitcher({ active, onChange }) {
  const index = VARIANTS.findIndex((variant) => variant.id === active)
  const previous = VARIANTS[(index - 1 + VARIANTS.length) % VARIANTS.length]
  const next = VARIANTS[(index + 1) % VARIANTS.length]
  const current = VARIANTS[index]

  if (!import.meta.env.DEV) return null
  return (
    <nav className="carousel-master__switcher" aria-label="切换 Carousel 母板">
      <button type="button" onClick={() => onChange(previous.id)} aria-label="上一个母板">←</button>
      <span>{current.label} · {current.name}</span>
      <button type="button" onClick={() => onChange(next.id)} aria-label="下一个母板">→</button>
    </nav>
  )
}

export default function CarouselMastersPrototype() {
  const params = new URLSearchParams(window.location.search)
  const initial = VARIANTS.some((variant) => variant.id === params.get('variant'))
    ? params.get('variant') : 'gallery'
  const [activeId, setActiveId] = useState(initial)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef(null)
  const active = VARIANTS.find((variant) => variant.id === activeId)

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
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set('prototype', 'carousel-masters')
    nextParams.set('variant', id)
    window.history.replaceState(null, '', `?${nextParams.toString()}`)
    setActiveId(id)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target.matches('input, textarea, [contenteditable="true"]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = VARIANTS.findIndex((variant) => variant.id === activeId)
      const nextIndex = event.key === 'ArrowLeft'
        ? (index - 1 + VARIANTS.length) % VARIANTS.length
        : (index + 1) % VARIANTS.length
      changeVariant(VARIANTS[nextIndex].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeId])

  const addPhotos = async (event) => {
    const files = [...event.target.files].filter((file) => file.type.startsWith('image/')).slice(0, 12)
    if (!files.length) return
    setLoading(true)
    setPhotos(await Promise.all(files.map(loadPhoto)))
    setLoading(false)
    event.target.value = ''
  }

  const frames = photos.length ? assignPhotos(photos, active.frames) : []
  return (
    <main className={`carousel-master carousel-master--${active.id}`}>
      <header className="carousel-master__header">
        <div>
          <p>PROTOTYPE · V3 连续作品母板</p>
          <h1>{active.name}</h1>
          <span>{active.note}</span>
        </div>
        <div className="carousel-master__actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
          <button type="button" onClick={() => inputRef.current?.click()}>换一组照片</button>
          <button type="button" onClick={() => { setLoading(true); makeDemoPhotos(10).then((demo) => { setPhotos(demo); setLoading(false) }) }}>恢复混合比例示例</button>
        </div>
      </header>

      <section className="carousel-master__stage" aria-label="五页连续作品预览">
        {loading ? <p className="carousel-master__loading">正在放入混合比例照片…</p> : (
          <div className="carousel-master__strip">
            {frames.map((frame, index) => <StoryFrame key={index} frame={frame} index={index} />)}
          </div>
        )}
      </section>

      <aside className="carousel-master__rules">
        <span>这轮要验证</span>
        <p>背景能否把五页连成一件作品；不同横竖比例是否会自然落入单图、对照与片段位置，而不用硬裁切。</p>
      </aside>
      <PrototypeSwitcher active={activeId} onChange={changeVariant} />
    </main>
  )
}
