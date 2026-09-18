import { useEffect, useMemo, useRef, useState } from 'react'
import { makeDemoPhotos } from '../shared/demo.js'
import { aspectOf, buildGalleryOverview, focusCameraFor } from './layout/overviewLayout.js'
import { loadV4Photo, releaseV4PhotoSources, sourceForV4Photo } from './lib/photoSources.js'
import './v4-gallery.css'

// PROTOTYPE — V4 Gallery: can a focus state stay inside the editorial collage
// by moving the viewport instead of extracting a picture into a new page?

const MIN_PHOTOS = 6
const MAX_PHOTOS = 10

function photoAlt(photo, index) {
  return photo.name ? `照片 ${index + 1}：${photo.name}` : `演示照片 ${index + 1}`
}

function nextSeed(seed) {
  const value = Math.random().toString(36).slice(2, 8)
  return `${seed.split('-')[0]}-${value}`
}

function useUrlSeed() {
  const initial = new URLSearchParams(window.location.search).get('seed') || 'gallery-01'
  const [seed, setSeed] = useState(initial)
  const update = (value) => {
    const params = new URLSearchParams(window.location.search)
    params.set('prototype', 'v4-gallery')
    params.set('seed', value)
    window.history.replaceState(null, '', `?${params.toString()}`)
    setSeed(value)
  }
  return [seed, update]
}

function OverviewTile({ tile, index, focused, onPick }) {
  const isFocused = focused?.id === tile.id
  return (
    <figure
      className={`v4-gallery__tile v4-gallery__tile--${tile.role} ${isFocused ? 'is-selected' : ''}`}
      style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.width}%`, aspectRatio: aspectOf(tile.photo), zIndex: tile.zIndex }}
    >
      <button type="button" className="v4-gallery__tile-button" onClick={() => onPick(tile)} aria-label={`原位聚焦 ${photoAlt(tile.photo, index)}`}>
        <img src={sourceForV4Photo(tile.photo, isFocused)} alt={photoAlt(tile.photo, index)} />
      </button>
    </figure>
  )
}

function ZoomControls({ focusedIndex, count, onExit, onStep }) {
  return (
    <nav className="v4-gallery__zoom-controls" aria-label="原位聚焦浏览">
      <button type="button" onClick={() => onStep(-1)} aria-label="上一张照片">←</button>
      <span aria-live="polite">PHOTO {String(focusedIndex + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
      <button type="button" onClick={onExit}>缩回总览</button>
      <button type="button" onClick={() => onStep(1)} aria-label="下一张照片">→</button>
    </nav>
  )
}

function Overview({ layout, focused, focusedIndex, onPick, onExit, onStep }) {
  const overviewRef = useRef(null)
  const camera = focused ? focusCameraFor(focused) : null
  const transform = camera
    ? `translate(${camera.translateX}%, ${camera.translateY}%) scale(${camera.scale})`
    : 'translate(0, 0) scale(1)'
  useEffect(() => {
    if (!focused) return undefined
    const timer = window.setTimeout(() => {
      overviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focused?.id])
  return (
    <section ref={overviewRef} className={`v4-gallery__overview-wrap ${focused ? 'is-zoomed' : ''}`} aria-label="Gallery Overview 总览">
      <div className="v4-gallery__zoom-viewport">
        <div className="v4-gallery__overview" style={{ transform }}>
          <header className="v4-gallery__masthead">
            <span>GALLERY · PHOTO STUDY</span>
          </header>
          <span className="v4-gallery__edition">{String(layout.length).padStart(2, '0')} PHOTOS · 4:5</span>
          {layout.map((tile, index) => <OverviewTile key={tile.id} tile={tile} index={index} focused={focused} onPick={onPick} />)}
        </div>
        {focused && <ZoomControls focusedIndex={focusedIndex} count={layout.length} onExit={onExit} onStep={onStep} />}
      </div>
      {focused && <p className="v4-gallery__zoom-caption">画布保持原始拼贴关系；使用 ← → 浏览相邻照片。</p>}
    </section>
  )
}

export default function V4GalleryPrototype() {
  const inputRef = useRef(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [seed, setSeed] = useUrlSeed()
  const [focusedId, setFocusedId] = useState(null)

  useEffect(() => {
    let live = true
    makeDemoPhotos(10).then((demo) => {
      if (!live) return
      setPhotos(demo)
      setLoading(false)
    })
    return () => { live = false }
  }, [])

  useEffect(() => () => releaseV4PhotoSources(photos), [photos])

  const layout = useMemo(() => buildGalleryOverview(photos, seed), [photos, seed])
  const focused = layout.find((tile) => tile.id === focusedId) || null
  const focusedIndex = focused ? photos.findIndex((photo) => photo.id === focused.id) : -1
  const step = (amount) => {
    if (focusedIndex < 0 || !photos.length) return
    const nextIndex = (focusedIndex + amount + photos.length) % photos.length
    setFocusedId(photos[nextIndex].id)
  }

  useEffect(() => {
    if (!focused) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'Escape') setFocusedId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focused, focusedIndex, photos])

  const regenerate = () => {
    setSeed(nextSeed(seed))
    setFocusedId(null)
  }
  const addPhotos = async (event) => {
    const files = [...event.target.files].filter((file) => file.type.startsWith('image/')).slice(0, MAX_PHOTOS)
    if (!files.length) return
    setLoading(true)
    const next = await Promise.all(files.map(loadV4Photo))
    setPhotos(next)
    setFocusedId(null)
    setLoading(false)
    event.target.value = ''
  }

  return (
    <main className="v4-gallery">
      <header className="v4-gallery__header">
        <div><p>PROTOTYPE · V4 / GALLERY</p><h2>一组照片，一件连续作品。</h2><span>Overview 建立编辑秩序；点击照片，镜头仍留在同一张拼贴里。</span></div>
        <div className="v4-gallery__actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
          <button type="button" onClick={() => inputRef.current?.click()}>上传 6–10 张照片</button>
          <button type="button" onClick={regenerate}>重新生成</button>
        </div>
      </header>
      <section className="v4-gallery__state" aria-label="原型状态"><span>GALLERY</span><span>4:5 OUTPUT</span><span>{photos.length || MIN_PHOTOS} PHOTOS</span><span>SEED · {seed}</span><span>{focused ? 'IN-PLACE ZOOM' : 'OVERVIEW'}</span></section>
      {loading ? <p className="v4-gallery__loading">正在准备混合比例演示照片…</p> : <Overview layout={layout} focused={focused} focusedIndex={focusedIndex} onPick={(tile) => setFocusedId(tile.id)} onExit={() => setFocusedId(null)} onStep={step} />}
      <aside className="v4-gallery__notes"><span>本轮验证</span><p>照片以紧凑的连续拼贴组成一个整体，主图作为群组内部的锚点。点击后，整张画布原位缩放并平移到目标图；照片仍保持真实比例和相对位置。透明遮挡效果将在下一阶段加入。</p></aside>
    </main>
  )
}
