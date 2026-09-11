import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  RECOMMENDED,
  isAcceptedFile,
  loadPhoto,
} from './lib/photo.js'
import { planPages } from './lib/plan.js'
import { pickCoverColor } from './lib/palette.js'
import AlbumViewer from './components/AlbumViewer.jsx'
import './App.css'

const STYLES = [
  { id: 'gallery', name: 'Gallery', desc: '克制 · 大留白 · 安静的摄影书' },
  { id: 'rhythm', name: 'Rhythm', desc: '更丰富的节奏 · 适合旅行与日常' },
  { id: 'frame', name: 'Frame', desc: '展览图录 · 装裱感 · 对尺寸更友好' },
]

export default function App() {
  const [photos, setPhotos] = useState([])
  const [title, setTitle] = useState('')
  const [style, setStyle] = useState('gallery')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [album, setAlbum] = useState(null)
  const inputRef = useRef(null)

  const addFiles = useCallback(
    async (fileList) => {
      const files = [...fileList].filter(isAcceptedFile)
      if (files.length === 0) {
        setError('仅支持 jpg / png / webp 格式')
        return
      }
      setError('')
      setLoading(true)
      try {
        const room = MAX_PHOTOS - photos.length
        const accepted = files.slice(0, room)
        const loaded = await Promise.all(accepted.map(loadPhoto))
        setPhotos((prev) => [...prev, ...loaded])
        if (files.length > room) {
          setError(`最多上传 ${MAX_PHOTOS} 张，超出部分已忽略`)
        }
      } catch {
        setError('部分图片读取失败，请重试')
      } finally {
        setLoading(false)
      }
    },
    [photos.length],
  )

  const removePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  const canGenerate = photos.length >= MIN_PHOTOS && !loading

  const generate = (styleId = style, seed = Math.floor(Math.random() * 1e9), photoList = photos) => {
    const pages = planPages(photoList, styleId, seed)
    setAlbum({
      title: title.trim() || 'Untitled Album',
      style: styleId,
      seed,
      coverColor: pickCoverColor(seed),
      photos: photoList,
      photosById: Object.fromEntries(photoList.map((p) => [p.id, p])),
      pages,
    })
  }

  // 演示模式：/?demo=N&go 自动填充测试图并成书
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const demoCount = parseInt(params.get('demo'), 10)
    if (!demoCount) return
    const n = Math.max(MIN_PHOTOS, Math.min(MAX_PHOTOS, demoCount))
    import('./lib/demo.js').then(({ makeDemoPhotos }) =>
      makeDemoPhotos(n).then((demoPhotos) => {
        setPhotos(demoPhotos)
        if (params.get('go')) {
          const seed = Math.floor(Math.random() * 1e9)
          const styleId = params.get('style') || 'gallery'
          setStyle(styleId)
          generate(styleId, seed, demoPhotos)
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (album) {
    return (
      <AlbumViewer
        album={album}
        onBack={() => setAlbum(null)}
        onRegenerate={() => generate(album.style)}
        onStyleChange={(styleId) => generate(styleId, album.seed)}
      />
    )
  }

  return (
    <div className="page">
      <header className="header">
        <h1 className="logo">albummm</h1>
        <p className="tagline">上传照片，生成一本有出版物质感的电子相册。</p>
      </header>

      <main className="main">
        <section
          className={`dropzone ${dragOver ? 'dropzone--over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            addFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <p className="dropzone__title">
            {loading ? '正在读取图片…' : '点按选择，或拖拽图片到这里'}
          </p>
          <p className="dropzone__hint">
            建议 {RECOMMENDED} 张 · 至少 {MIN_PHOTOS} 张 · 最多 {MAX_PHOTOS} 张
          </p>
        </section>

        {error && <p className="error">{error}</p>}

        {photos.length > 0 && (
          <section className="thumbs">
            {photos.map((p) => (
              <figure key={p.id} className="thumb">
                <img src={p.previewSrc} alt={p.name} loading="lazy" />
                <button
                  type="button"
                  className="thumb__remove"
                  aria-label={`删除 ${p.name}`}
                  onClick={() => removePhoto(p.id)}
                >
                  ×
                </button>
              </figure>
            ))}
          </section>
        )}

        <section className="field">
          <label className="field__label" htmlFor="album-title">
            相册名称（可选）
          </label>
          <input
            id="album-title"
            className="field__input"
            type="text"
            placeholder="Untitled Album"
            maxLength={40}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </section>

        <section className="field">
          <span className="field__label">风格</span>
          <div className="styles" role="radiogroup" aria-label="风格">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                className={`style-card ${style === s.id ? 'style-card--active' : ''}`}
                onClick={() => setStyle(s.id)}
              >
                <span className="style-card__name">{s.name}</span>
                <span className="style-card__desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          className="generate"
          disabled={!canGenerate}
          onClick={() => generate()}
        >
          {loading
            ? '读取中…'
            : canGenerate
              ? '生成相册'
              : `还需 ${MIN_PHOTOS - photos.length} 张图片`}
        </button>
      </main>
    </div>
  )
}
