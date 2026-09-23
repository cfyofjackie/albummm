import { useEffect, useMemo, useRef, useState } from 'react'
import { makeDemoPhotos } from '../shared/demo.js'
import { loadPhoto, releasePhotoSource } from '../shared/photo.js'
import { ALLOWED_FORMATS, FRAME_MODES, REQUIRED_PHOTO_COUNT, acceptedFormatFor, buildReferenceLayout } from './layout.js'
import { buildAutoDecorationPlacements } from './decorations.js'
import { BoardDecorations, CardDecoration } from './V5Decorations.jsx'
import V5FocusViewer from './V5FocusViewer.jsx'
import './v5.css'

const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const DECORATION_MODES = {
  none: { id: 'none', label: '无' },
  scrapbook: { id: 'scrapbook', label: '手帐涂鸦' },
}

function fileProblem(file) {
  return ACCEPTED_MIME_TYPES.has(file.type) ? null : `${file.name} 不是 JPG、PNG 或 WebP 图片`
}

function formatCountMessage(accepted, rejected) {
  if (accepted.length === REQUIRED_PHOTO_COUNT && !rejected.length) return null
  const reasons = []
  if (rejected.length) reasons.push(`${rejected.length} 张比例或格式不符合要求`)
  if (accepted.length !== REQUIRED_PHOTO_COUNT) reasons.push(`目前可用 ${accepted.length} 张，需要正好 ${REQUIRED_PHOTO_COUNT} 张`)
  return reasons.join('；')
}

export default function V5CollagePrototype() {
  const inputRef = useRef(null)
  const boardRef = useRef(null)
  const photosRef = useRef([])
  const [photos, setPhotos] = useState([])
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [frameMode, setFrameMode] = useState(FRAME_MODES.none.id)
  const [decorationMode, setDecorationMode] = useState(DECORATION_MODES.none.id)
  const [focusRequest, setFocusRequest] = useState(null)

  const replacePhotos = (nextPhotos) => {
    photosRef.current.forEach(releasePhotoSource)
    photosRef.current = nextPhotos
    setPhotos(nextPhotos)
  }

  useEffect(() => {
    let active = true
    // 首屏仅使用本地生成的合规演示照片，让第一个模板能立刻被检查；用户上传后完全替换。
    makeDemoPhotos(20).then((demo) => {
      if (!active) {
        demo.forEach(releasePhotoSource)
        return
      }
      const accepted = demo.filter((photo) => acceptedFormatFor(photo)).slice(0, REQUIRED_PHOTO_COUNT)
      demo.filter((photo) => !accepted.includes(photo)).forEach(releasePhotoSource)
      replacePhotos(accepted)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => () => { photosRef.current.forEach(releasePhotoSource) }, [])

  const layout = useMemo(
    () => (photos.length === REQUIRED_PHOTO_COUNT ? buildReferenceLayout(photos, frameMode) : []),
    [photos, frameMode],
  )
  const autoDecorationPlacements = useMemo(() => buildAutoDecorationPlacements(layout), [layout])

  const chooseFiles = async (event) => {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length) return

    const typeErrors = files.map(fileProblem).filter(Boolean)
    const imageFiles = files.filter((file) => !fileProblem(file))
    setLoading(true)
    const loaded = await Promise.all(imageFiles.map(loadPhoto))
    const accepted = loaded.filter((photo) => acceptedFormatFor(photo))
    const rejected = loaded.filter((photo) => !acceptedFormatFor(photo))
    const problem = formatCountMessage(accepted, rejected)

    if (typeErrors.length || problem) {
      loaded.forEach(releasePhotoSource)
      setNotice([typeErrors[0], problem].filter(Boolean).join('；'))
      setLoading(false)
      return
    }
    replacePhotos(accepted)
    setNotice('已换成你上传的 10 张照片。所有图片都按原始比例完整显示。')
    setLoading(false)
  }

  const preloadOriginal = (photo) => {
    if (!photo?.originalSrc) return
    const image = new Image()
    image.src = photo.originalSrc
    image.decode?.().catch(() => {})
  }

  const openFocus = (tile) => {
    const boardRect = boardRef.current?.getBoundingClientRect()
    if (!boardRect) return
    preloadOriginal(tile.photo)
    setFocusRequest({ tileId: tile.id, boardRect: { left: boardRect.left, top: boardRect.top, width: boardRect.width, height: boardRect.height } })
  }

  return (
    <main className="v5-collage">
      <header className="v5-collage__header">
        <div>
          <p className="v5-collage__crumb">
            <a className="v5-collage__home" href="#/">← 首页</a>
            <span>单张拼贴</span>
          </p>
          <h1>十张照片，一种排布。</h1>
          <span>边框与手帐涂鸦可以独立切换，随时点开单张看高清。</span>
        </div>
        <div className="v5-collage__actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={chooseFiles} />
          <button type="button" onClick={() => inputRef.current?.click()}>上传 10 张照片</button>
        </div>
      </header>

      <p className="v5-collage__hint">
        当前仅接收 {ALLOWED_FORMATS.map((format) => format.label).join(' / ')}；16:9、9:16 等屏幕比例暂不进入这个模板。
      </p>
      <div className="v5-collage__frame-toggle" role="group" aria-label="选择照片边框">
        <span>边框</span>
        {Object.values(FRAME_MODES).map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={frameMode === mode.id ? 'is-active' : ''}
            aria-pressed={frameMode === mode.id}
            onClick={() => setFrameMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="v5-collage__frame-toggle" role="group" aria-label="选择拼贴装饰">
        <span>装饰</span>
        {Object.values(DECORATION_MODES).map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={decorationMode === mode.id ? 'is-active' : ''}
            aria-pressed={decorationMode === mode.id}
            onClick={() => setDecorationMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      {notice && <p className="v5-collage__notice" role="status">{notice}</p>}

      {loading ? <p className="v5-collage__loading">正在准备照片…</p> : (
        <section className="v5-collage__stage" aria-label="十张照片的参考拼贴排布">
          <div className="v5-collage__board" ref={boardRef}>
            <BoardDecorations enabled={decorationMode === DECORATION_MODES.scrapbook.id} autoPlacements={autoDecorationPlacements} />
            {layout.map((tile, index) => {
              const photoStyle = {
                left: `${((tile.content.x - tile.x) / tile.width) * 100}%`,
                top: `${((tile.content.y - tile.y) / tile.height) * 100}%`,
                width: `${(tile.content.width / tile.width) * 100}%`,
                height: `${(tile.content.height / tile.height) * 100}%`,
              }
              return (
                <figure
                  key={tile.id}
                  className={`v5-collage__photo v5-collage__photo--${frameMode}`}
                  style={{
                    left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.width}%`, height: `${tile.height}%`,
                    zIndex: tile.z, transform: `rotate(${tile.rotate}deg)`,
                  }}
                  onClick={() => openFocus(tile)}
                  onPointerEnter={() => preloadOriginal(tile.photo)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openFocus(tile)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {frameMode === FRAME_MODES.polaroid.id && <span className="v5-collage__paper" aria-hidden="true" />}
                  <img style={photoStyle} src={tile.photo.previewSrc} alt={`第 ${index + 1} 张上传照片`} />
                  <CardDecoration index={index} enabled={decorationMode === DECORATION_MODES.scrapbook.id} />
                </figure>
              )
            })}
          </div>
        </section>
      )}
      {focusRequest && (
        <V5FocusViewer
          layout={layout}
          initialTileId={focusRequest.tileId}
          boardRect={focusRequest.boardRect}
          frameMode={frameMode}
          decorationEnabled={decorationMode === DECORATION_MODES.scrapbook.id}
          autoPlacements={autoDecorationPlacements}
          onClose={() => setFocusRequest(null)}
        />
      )}
    </main>
  )
}
