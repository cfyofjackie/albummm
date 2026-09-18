import { useEffect, useMemo, useRef, useState } from 'react'
import { makeDemoPhotos } from '../shared/demo.js'
import { loadPhoto } from '../shared/photo.js'
import { buildGalleryOverview, intersectionOf, obscurersFor } from './layout/overviewLayout.js'
import './v4-gallery.css'

// PROTOTYPE — V4 Gallery: does an editorial overview naturally lead into a
// continuous, single-image Focus Page? Open /?prototype=v4-gallery.

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

function GlassPane({ obscurer, selected }) {
  const intersection = intersectionOf(obscurer, selected)
  if (!intersection) return null
  const left = (intersection.x - obscurer.x) / obscurer.width * 100
  const top = (intersection.y - obscurer.y) / obscurer.height * 100
  const width = intersection.width / obscurer.width * 100
  const height = intersection.height / obscurer.height * 100
  return <span className="v4-gallery__glass-pane" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} aria-hidden="true" />
}

function OverviewTile({ tile, index, selected, obscurers, onPick }) {
  const isSelected = selected?.id === tile.id
  const isObscurer = obscurers.some((item) => item.id === tile.id)
  const selectedIntersection = isObscurer ? intersectionOf(tile, selected) : null
  const maskId = `v4-hole-${tile.id}`
  const hole = selectedIntersection && {
    x: (selectedIntersection.x - tile.x) / tile.width * 100,
    y: (selectedIntersection.y - tile.y) / tile.height * 100,
    width: selectedIntersection.width / tile.width * 100,
    height: selectedIntersection.height / tile.height * 100,
  }
  return (
    <figure
      className={`v4-gallery__tile v4-gallery__tile--${tile.role} ${isSelected ? 'is-selected' : ''} ${isObscurer ? 'is-glazing' : ''}`}
      style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.width}%`, height: `${tile.height}%`, zIndex: tile.zIndex }}
    >
      {hole && <svg className="v4-gallery__masks" aria-hidden="true"><defs><mask id={maskId} x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="white" /><rect x={`${hole.x}%`} y={`${hole.y}%`} width={`${hole.width}%`} height={`${hole.height}%`} fill="black" /></mask></defs></svg>}
      <button type="button" className="v4-gallery__tile-button" onClick={() => onPick(tile)} aria-label={`查看 ${photoAlt(tile.photo, index)}`}>
        <img src={tile.photo.previewSrc} alt={photoAlt(tile.photo, index)} style={hole ? { mask: `url(#${maskId})`, WebkitMask: `url(#${maskId})` } : undefined} />
        {isObscurer && <GlassPane obscurer={tile} selected={selected} />}
      </button>
    </figure>
  )
}

function Overview({ layout, selected, onPick }) {
  const obscurers = selected ? obscurersFor(selected, layout) : []
  return (
    <section className="v4-gallery__overview-wrap" aria-label="Gallery Overview 总览">
      <div className="v4-gallery__overview">
        <header className="v4-gallery__masthead">
          <span>GALLERY / 01</span>
          <h1>small<br />archive</h1>
          <p>AN EDITED GROUP OF {String(layout.length).padStart(2, '0')} PHOTOGRAPHS</p>
        </header>
        <span className="v4-gallery__edition">OVERVIEW · 4:5</span>
        {layout.map((tile, index) => <OverviewTile key={tile.id} tile={tile} index={index} selected={selected} obscurers={obscurers} onPick={onPick} />)}
        {selected && <div className="v4-gallery__focus-hint">再次点击选中照片，进入单图浏览</div>}
      </div>
    </section>
  )
}

function FocusPage({ photos, index, onClose, onStep }) {
  const current = photos[index]
  const previous = photos[(index - 1 + photos.length) % photos.length]
  const next = photos[(index + 1) % photos.length]
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') onStep(-1)
      if (event.key === 'ArrowRight') onStep(1)
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onStep])
  return (
    <section className="v4-focus" aria-label={`Focus Page ${index + 1}`}>
      <header className="v4-focus__header">
        <button type="button" onClick={onClose}>返回总览</button>
        <span>GALLERY / FOCUS</span>
        <span>{String(index + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</span>
      </header>
      <div className="v4-focus__viewer">
        <button type="button" className="v4-focus__peek v4-focus__peek--previous" onClick={() => onStep(-1)} aria-label="上一张照片"><img src={previous.previewSrc} alt="" /></button>
        <figure className="v4-focus__page"><img src={current.previewSrc} alt={photoAlt(current, index)} /><figcaption>PHOTO {String(index + 1).padStart(2, '0')} · USE ← → TO BROWSE</figcaption></figure>
        <button type="button" className="v4-focus__peek v4-focus__peek--next" onClick={() => onStep(1)} aria-label="下一张照片"><img src={next.previewSrc} alt="" /></button>
      </div>
      <nav className="v4-focus__controls" aria-label="Focus Page 翻页"><button type="button" onClick={() => onStep(-1)}>← 上一张</button><button type="button" onClick={() => onStep(1)}>下一张 →</button></nav>
    </section>
  )
}

export default function V4GalleryPrototype() {
  const inputRef = useRef(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [seed, setSeed] = useUrlSeed()
  const [selectedId, setSelectedId] = useState(null)
  const [focusIndex, setFocusIndex] = useState(null)

  useEffect(() => {
    let live = true
    makeDemoPhotos(10).then((demo) => {
      if (!live) return
      setPhotos(demo)
      setLoading(false)
    })
    return () => { live = false }
  }, [])

  const layout = useMemo(() => buildGalleryOverview(photos, seed), [photos, seed])
  const selected = layout.find((tile) => tile.id === selectedId) || null
  const selectedIndex = selected ? photos.findIndex((photo) => photo.id === selected.id) : -1
  const pick = (tile) => {
    if (tile.id === selectedId) setFocusIndex(photos.findIndex((photo) => photo.id === tile.id))
    else setSelectedId(tile.id)
  }
  const regenerate = () => {
    setSeed(nextSeed(seed))
    setSelectedId(null)
  }
  const addPhotos = async (event) => {
    const files = [...event.target.files].filter((file) => file.type.startsWith('image/')).slice(0, MAX_PHOTOS)
    if (!files.length) return
    setLoading(true)
    const next = await Promise.all(files.map(loadPhoto))
    setPhotos(next)
    setSelectedId(null)
    setFocusIndex(null)
    setLoading(false)
    event.target.value = ''
  }
  const step = (amount) => setFocusIndex((index) => (index + amount + photos.length) % photos.length)

  if (focusIndex !== null) return <FocusPage photos={photos} index={focusIndex} onClose={() => setFocusIndex(null)} onStep={step} />
  return (
    <main className="v4-gallery">
      <header className="v4-gallery__header">
        <div><p>PROTOTYPE · V4 / GALLERY</p><h2>一组照片，一件连续作品。</h2><span>Overview 建立编辑秩序；Focus Page 让每张照片继续呼吸。</span></div>
        <div className="v4-gallery__actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
          <button type="button" onClick={() => inputRef.current?.click()}>上传 6–10 张照片</button>
          <button type="button" onClick={regenerate}>重新生成</button>
        </div>
      </header>
      <section className="v4-gallery__state" aria-label="原型状态"><span>GALLERY</span><span>4:5 OUTPUT</span><span>{photos.length || MIN_PHOTOS} PHOTOS</span><span>SEED · {seed}</span></section>
      {loading ? <p className="v4-gallery__loading">正在准备混合比例演示照片…</p> : <Overview layout={layout} selected={selected} onPick={pick} />}
      <aside className="v4-gallery__notes"><span>本轮验证</span><p>主图、次图与细节图由同一母板安排；照片保持真实比例。点击有遮挡的照片会进入原位聚焦，再次点击即可连续浏览 Focus Pages。</p>{selected && <button type="button" onClick={() => setFocusIndex(selectedIndex)}>打开 Focus Page →</button>}</aside>
    </main>
  )
}
