import { useEffect, useMemo, useRef, useState } from 'react'
import { makeDemoPhotos } from '../shared/demo.js'
import { DEFAULT_TEMPLATE_ID, MAX_SOLVED_PHOTOS, RATIO_HINT, allTemplates, aspectOf, boardFor, buildGalleryOverview, describeRejection, describeSuggestion, focusCameraFor, getTemplate, overviewTextFor, partitionByRatio } from './layout/overviewLayout.js'
import { loadV4Photo, releaseV4PhotoSources, sourceForV4Photo } from './lib/photoSources.js'
import './v4-gallery.css'

// PROTOTYPE — V4 Gallery: can a focus state stay inside the editorial collage
// by moving the viewport instead of extracting a picture into a new page?

const MIN_PHOTOS = 6
// Matches the solver's own cap, so the upload gate and the layout cannot disagree
// about how many photos a sheet will hold.
const MAX_PHOTOS = MAX_SOLVED_PHOTOS

// Every vertical number in a solved layout is a percent of the BOARD'S HEIGHT, and
// every horizontal one is a percent of its WIDTH. Those two axes are only
// interchangeable through the board's own shape, so a tile's `top` / `height` has to
// be scaled by it before it reaches CSS. This is the renderer's one line of unit
// arithmetic; the solver's lives in layout/board.js.
const yFactorOf = (board) => board.yFactor

function photoAlt(photo, index) {
  return photo.name ? `照片 ${index + 1}：${photo.name}` : `演示照片 ${index + 1}`
}

function nextSeed(seed) {
  const value = Math.random().toString(36).slice(2, 8)
  return `${seed.split('-')[0]}-${value}`
}

function useUrlParam(name, fallback) {
  const initial = new URLSearchParams(window.location.search).get(name) || fallback
  const [value, setValue] = useState(initial)
  const update = (next) => {
    const params = new URLSearchParams(window.location.search)
    params.set('prototype', 'v4-gallery')
    params.set(name, next)
    window.history.replaceState(null, '', `?${params.toString()}`)
    setValue(next)
  }
  return [value, update]
}

function useUrlSeed() {
  return useUrlParam('seed', 'gallery-01')
}

function OverviewTile({ tile, index, focused, onPick, yFactor }) {
  const isFocused = focused?.id === tile.id
  const button = (
    <button type="button" className="v4-gallery__tile-button" onClick={() => onPick(tile)} aria-label={`原位聚焦 ${photoAlt(tile.photo, index)}${tile.crop ? '（已裁切）' : ''}`}>
      <img src={sourceForV4Photo(tile.photo, isFocused)} alt={photoAlt(tile.photo, index)} />
    </button>
  )
  const common = {
    className: `v4-gallery__tile v4-gallery__tile--${tile.role} ${isFocused ? 'is-selected' : ''}`,
    'data-cropped': tile.crop ? 'true' : undefined,
    title: tile.crop ? '这张照片比例超出可用范围，已居中裁切' : undefined,
  }

  // Stacked collage prints: instant prints dropped on a sheet, tilted, covering each
  // other. Centre-anchored, because a CSS rotation turns about the centre.
  //
  // The card is placed by its top-left corner rather than its centre. Everything the
  // renderer needs is then a plain offset — no half-width subtraction, no second
  // chance to mix the two axes up — and the rotation is still about the centre, via
  // an explicit transform-origin. The photo is inset from that card by fractions of
  // the CARD's own size, so every percentage below resolves against one single box
  // and the photo's shape cannot drift from the ratio the layout committed to.
  if (tile.pile) {
    const { width: cardW, height: cardH, border, lip } = tile.card
    // The layout reports the card in width units on both axes, because that is the one
    // space where its shape is measurable. CSS `top` and `height` resolve against the
    // board's HEIGHT, so this is where — and the ONLY place where — a vertical value is
    // converted. `yFactor` is the board's own ratio, so a 4:3 sheet converts by 0.75
    // and a 4:5 sheet by 1.25.
    const frameH = cardH * yFactor
    const top = (tile.centreY - cardH / 2) * yFactor
    return (
      <figure
        {...common}
        className={`${common.className} v4-gallery__tile--print`}
        style={{
          left: `${tile.centreX - cardW / 2}%`,
          top: `${top}%`,
          width: `${cardW}%`,
          height: `${frameH}%`,
          transform: `rotate(${tile.tilt.toFixed(2)}deg)`,
          transformOrigin: '50% 50%',
          zIndex: tile.zIndex,
        }}
      >
        <span
          className="v4-gallery__print-photo"
          style={{
            left: `${(border / cardW) * 100}%`,
            top: `${(border / frameH) * 100}%`,
            width: `${((cardW - border * 2) / cardW) * 100}%`,
            height: `${((frameH - border - lip) / frameH) * 100}%`,
          }}
        >
          {button}
        </span>
      </figure>
    )
  }

  return (
    <figure
      {...common}
      style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.width}%`, aspectRatio: aspectOf(tile.photo), zIndex: tile.zIndex }}
    >
      {button}
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

// The typography is a static preset for this template: it exists so the photo
// block can be judged inside the composition it was designed for. The reference
// reads top-down — title and place, then the block, then the quoted line — so the
// canvas is built in that order and the block is positioned between them.
//
// A template may declare no fields at all, and then there is nothing to draw: 满幅
// 拼贴 prints photos on blank paper, so its canvas is the photos and the count.
function OverviewChrome({ text, count, boardKey }) {
  const hasType = Boolean(text.title || text.subtitle || text.date || text.captionQuote || text.signature)
  return (
    <>
      {hasType && (
        <header className="v4-gallery__board-head">
          <p className="v4-gallery__board-title">
            <em>{text.title}</em>
            <span>{text.subtitle}</span>
          </p>
          <div className="v4-gallery__board-meta">
            <span>{text.place}</span>
            <span>{text.date}</span>
          </div>
        </header>
      )}
      {hasType && (
        <footer className="v4-gallery__board-foot">
          <p className="v4-gallery__board-label">{text.captionLabel}</p>
          <p className="v4-gallery__board-quote">{text.captionQuote}</p>
          {text.captionBody.map((line) => <p key={line} className="v4-gallery__board-body">{line}</p>)}
          <p className="v4-gallery__board-sign">{text.signature}</p>
        </footer>
      )}
      <span className="v4-gallery__board-count">{String(count).padStart(2, '0')} · {boardKey}</span>
    </>
  )
}

function Overview({ layout, text, board, focused, focusedIndex, onPick, onExit, onStep }) {
  const overviewRef = useRef(null)
  const yFactor = yFactorOf(board)
  const camera = focused ? focusCameraFor(focused, board) : null
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
      <div className="v4-gallery__zoom-viewport" style={{ aspectRatio: `${board.ratio[0]} / ${board.ratio[1]}` }} data-board={`${board.key} y${board.yFactor} h${board.height}`}>
        <div className="v4-gallery__overview" style={{ transform }}>
          <OverviewChrome text={text} count={layout.length} boardKey={board.key} />
          {layout.map((tile, index) => <OverviewTile key={tile.id} tile={tile} index={index} focused={focused} onPick={onPick} yFactor={yFactor} />)}
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
  const [templateId, setTemplateId] = useUrlParam('template', DEFAULT_TEMPLATE_ID)
  const [focusedId, setFocusedId] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let live = true
    // The demo set carries two out-of-band screen ratios that the upload gate
    // refuses, so more than MAX_PHOTOS are generated to leave a full sheet behind.
    makeDemoPhotos(MAX_PHOTOS + 4).then((demo) => {
      if (!live) return
      setPhotos(demo.slice(0, MAX_PHOTOS))
      setLoading(false)
    })
    return () => { live = false }
  }, [])

  useEffect(() => () => releaseV4PhotoSources(photos), [photos])

  const layout = useMemo(() => {
    const solved = buildGalleryOverview(photos, seed, templateId)
    // Debug hook for the screenshot harness: the solved geometry, so a rendered page
    // can be compared against the numbers instead of guessed at.
    if (typeof window !== 'undefined') window.__V4_LAYOUT = solved
    return solved
  }, [photos, seed, templateId])
  // The active template's own sheet: 4:5 for the editorial pages, 4:3 for the
  // full-bleed collage. The canvas renders its true proportions rather than a fixed
  // one, so a second board ratio needs no change here.
  const board = useMemo(() => boardFor(getTemplate(templateId)), [templateId])
  // Typography comes from the active template, so a second template brings its own
  // composition rather than borrowing the first one's words. A template with no
  // fields brings none, and the canvas draws none.
  const text = useMemo(() => overviewTextFor(getTemplate(templateId)), [templateId])
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
    setNotice(null)
    const loaded = await Promise.all(files.map(loadV4Photo))
    // Refuse unsuitable proportions at the door rather than accepting them and
    // mangling them. The band is the one in ratioPolicy.js, which is also what the
    // solver clamps to, so the message and the behaviour cannot drift apart.
    const { accepted, rejected } = partitionByRatio(loaded)
    if (rejected.length) {
      releaseV4PhotoSources(rejected)
      setNotice({ kind: 'error', message: describeRejection(rejected) })
    }
    if (accepted.length) {
      setPhotos(accepted.slice(0, MAX_PHOTOS))
      setFocusedId(null)
      if (!rejected.length) setNotice({ kind: 'ok', message: `已载入 ${accepted.length} 张。` })
    }
    setLoading(false)
    event.target.value = ''
  }

  return (
    <main className="v4-gallery">
      <header className="v4-gallery__header">
        <div><p>PROTOTYPE · V4 / GALLERY</p><h2>一组照片，一件连续作品。</h2><span>Overview 建立编辑秩序；点击照片，镜头仍留在同一张拼贴里。</span></div>
        <div className="v4-gallery__actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
          <button type="button" onClick={() => inputRef.current?.click()}>{`上传 ${MIN_PHOTOS}–${MAX_PHOTOS} 张照片`}</button>
          <button type="button" onClick={regenerate}>重新生成</button>
        </div>
      </header>
      <section className="v4-gallery__state" aria-label="原型状态"><span>GALLERY</span><span>4:5 OUTPUT</span><span>{photos.length || MIN_PHOTOS} PHOTOS</span><span>SEED · {seed}</span><span>{focused ? 'IN-PLACE ZOOM' : 'OVERVIEW'}</span></section>
      <nav className="v4-gallery__templates" aria-label="选择模板">
        {allTemplates().map((skeleton) => (
          <button
            key={skeleton.id}
            type="button"
            className={skeleton.id === templateId ? 'is-active' : ''}
            onClick={() => { setTemplateId(skeleton.id); setFocusedId(null) }}
          >
            <strong>{skeleton.label}</strong>
            <em>{describeSuggestion(skeleton)}</em>
          </button>
        ))}
      </nav>
      {/* The proportion band is a product rule, so it is stated where photos are
          chosen rather than discovered by having an upload refused. */}
      <p className="v4-gallery__ratio-hint">{RATIO_HINT}</p>
      {notice && <p className={`v4-gallery__notice v4-gallery__notice--${notice.kind}`} role="status">{notice.message}</p>}
      {loading ? <p className="v4-gallery__loading">正在准备混合比例演示照片…</p> : <Overview layout={layout} text={text} board={board} focused={focused} focusedIndex={focusedIndex} onPick={(tile) => setFocusedId(tile.id)} onExit={() => setFocusedId(null)} onStep={step} />}
      <aside className="v4-gallery__notes"><span>本轮验证</span><p>照片以紧凑的连续拼贴组成一个整体。点击后，整张画布原位缩放并平移到目标图；照片仍保持真实比例和相对位置。透明遮挡效果将在下一阶段加入。</p></aside>
    </main>
  )
}
