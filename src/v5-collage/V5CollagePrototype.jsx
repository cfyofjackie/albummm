import { useEffect, useMemo, useRef, useState } from 'react'
import { makeDemoPhotos } from '../shared/demo.js'
import { loadPhoto, releasePhotoSource } from '../shared/photo.js'
import { ALLOWED_FORMATS, FRAME_MODES, REQUIRED_PHOTO_COUNT, acceptedFormatFor, buildReferenceLayout, partitionUploads } from './layout.js'
import { buildAutoDecorationPlacements } from './decorations.js'
import { BoardDecorations, CardDecoration } from './V5Decorations.jsx'
import V5FocusViewer from './V5FocusViewer.jsx'
import { renderBoardPreview } from './focusExport.js'
import './v5.css'

const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const DECORATION_MODES = {
  none: { id: 'none', label: '无' },
  scrapbook: { id: 'scrapbook', label: '手帐涂鸦' },
}

function fileProblem(file) {
  return ACCEPTED_MIME_TYPES.has(file.type) ? null : `${file.name} 不是 JPG、PNG 或 WebP 图片`
}

// 只读尺寸、不做完整加载：判定「选了多少张、合格几张」不需要生成预览和原图地址，
// 只有最终采用的照片才走 loadPhoto（解码 + 1600px 预览 + blob URL）。
function photoSizeOf(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

function uploadKindFor(file, size) {
  if (fileProblem(file)) return 'type'
  if (!size || !acceptedFormatFor(size)) return 'ratio'
  return 'valid'
}

export default function V5CollagePrototype() {
  const inputRef = useRef(null)
  const boardRef = useRef(null)
  const boardPreviewImageRef = useRef(null)
  const photosRef = useRef([])
  const [photos, setPhotos] = useState([])
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [frameMode, setFrameMode] = useState(FRAME_MODES.none.id)
  const [decorationMode, setDecorationMode] = useState(DECORATION_MODES.none.id)
  const [focusRequest, setFocusRequest] = useState(null)
  const [boardPreviewSrc, setBoardPreviewSrc] = useState(null)

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

  useEffect(() => {
    setBoardPreviewSrc(null)
    if (!layout.length) return
    let cancelled = false
    let previewUrl = null
    const render = () => {
      renderBoardPreview({
        layout, frameMode, decorationEnabled: decorationMode === DECORATION_MODES.scrapbook.id,
        autoPlacements: autoDecorationPlacements, width: boardRef.current?.clientWidth || 960,
      }).then(async (blob) => {
        if (cancelled || !blob) return
        previewUrl = URL.createObjectURL(blob)
        const image = new Image()
        image.src = previewUrl
        try { await image.decode?.() } catch {
          URL.revokeObjectURL(previewUrl)
          previewUrl = null
          return
        }
        if (cancelled) return
        boardPreviewImageRef.current = image
        setBoardPreviewSrc(previewUrl)
      }).catch(() => {})
    }
    const idleId = window.requestIdleCallback ? window.requestIdleCallback(render, { timeout: 1000 }) : window.setTimeout(render, 50)
    return () => {
      cancelled = true
      if (window.cancelIdleCallback) window.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
      boardPreviewImageRef.current = null
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [layout, frameMode, decorationMode, autoDecorationPlacements])

  const chooseFiles = async (event) => {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length) return

    setLoading(true)
    // 第一遍只读格式与尺寸；按选择顺序取前 10 张合规照片，其余文件不解码、不占内存。
    const sizes = await Promise.all(files.map(photoSizeOf))
    const summary = partitionUploads(files.map((file, index) => uploadKindFor(file, sizes[index])))
    const loaded = await Promise.all(summary.adoptedIndexes.map((index) => loadPhoto(files[index])))

    if (loaded.length !== REQUIRED_PHOTO_COUNT) {
      // 数量不足时整批保留原拼贴：正好 10 张是布局引擎的硬约束（见 layout.js）。
      loaded.forEach(releasePhotoSource)
      const reasons = []
      if (summary.ratioRejected) reasons.push(`${summary.ratioRejected} 张比例不符合要求`)
      if (summary.typeRejected) reasons.push(`${summary.typeRejected} 张不是 JPG、PNG 或 WebP`)
      setNotice(`合规照片只有 ${loaded.length} 张，这个模板需要正好 ${REQUIRED_PHOTO_COUNT} 张${reasons.length ? `（${reasons.join('；')}）` : ''}；已保留原拼贴。`)
      setLoading(false)
      return
    }

    replacePhotos(loaded)
    const extras = []
    if (summary.unusedValid) extras.push(`另有 ${summary.unusedValid} 张未使用`)
    if (summary.ratioRejected) extras.push(`${summary.ratioRejected} 张比例不符合要求`)
    if (summary.typeRejected) extras.push(`${summary.typeRejected} 张不是 JPG、PNG 或 WebP`)
    setNotice(`已使用前 ${REQUIRED_PHOTO_COUNT} 张合规照片${extras.length ? `（${extras.join('；')}）` : ''}。所有图片都按原始比例完整显示。`)
    setLoading(false)
  }

  const openFocus = (tile) => {
    const boardRect = boardRef.current?.getBoundingClientRect()
    if (!boardRect) return
    setFocusRequest({ tileId: tile.id, boardPreviewSrc, boardRect: { left: boardRect.left, top: boardRect.top, width: boardRect.width, height: boardRect.height } })
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
          boardPreviewSrc={focusRequest.boardPreviewSrc}
          onClose={() => setFocusRequest(null)}
        />
      )}
    </main>
  )
}
