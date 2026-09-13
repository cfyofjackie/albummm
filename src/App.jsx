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
import { DEFAULT_PAGE_FORMAT, getPageFormat } from './lib/pageFormat.js'
import AlbumViewer from './components/AlbumViewer.jsx'
import ClosedBook from './components/ClosedBook.jsx'
import './App.css'

const STYLES = [
  { id: 'gallery', name: 'Gallery', desc: '克制 · 大留白 · 安静的摄影书' },
  { id: 'rhythm', name: 'Rhythm', desc: '更丰富的节奏 · 适合旅行与日常' },
  { id: 'frame', name: 'Frame', desc: '展览图录 · 装裱感 · 对尺寸更友好' },
  { id: 'studio', name: 'Studio', desc: '摄影书 · 跨页主图 · 严格白边网格' },
]

export default function App() {
  const [photos, setPhotos] = useState([])
  const [title, setTitle] = useState('')
  const [style, setStyle] = useState('gallery')
  const [format, setFormat] = useState(DEFAULT_PAGE_FORMAT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [album, setAlbum] = useState(null)
  const [opened, setOpened] = useState(false) // false = 合着的书（刚生成完）；true = 翻开在读
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

  const generate = (
    styleId = style,
    seed = Math.floor(Math.random() * 1e9),
    photoList = photos,
    formatId = format,
  ) => {
    const pages = planPages(photoList, styleId, seed, formatId)
    setAlbum({
      title: title.trim() || 'Untitled Album',
      style: styleId,
      format: getPageFormat(formatId),
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
          setOpened(!params.get('closed'))
          const seed = Math.floor(Math.random() * 1e9)
          const styleId = params.get('style') || 'gallery'
          const formatId = params.get('format') || DEFAULT_PAGE_FORMAT
          setStyle(styleId)
          setFormat(formatId)
          generate(styleId, seed, demoPhotos, formatId)
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 合着的书：生成完成后的落点。点一下翻开，直接落在第一页内容（不再重复看封面）。
  if (album && !opened) {
    return <ClosedBook album={album} onOpen={() => setOpened(true)} />
  }

  if (album) {
    return (
      <AlbumViewer
        initialLeaf={1}
        album={album}
        onBack={() => setAlbum(null)}
        onRegenerate={() => generate(album.style, undefined, album.photos, album.format.id)}
        onStyleChange={(styleId) => {
          setStyle(styleId)
          generate(styleId, album.seed, album.photos, album.format.id)
        }}
        onFormatChange={(formatId) => {
          setFormat(formatId)
          generate(album.style, album.seed, album.photos, formatId)
        }}
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

        {/* 开本只做 3:4（手机竖屏上最舒服：跨页落在 3:2，接近一本实物书的观感；
            4:3 那类开本在手机上会把书压成一条纸带）。PAGE_FORMATS / formatId 机制保留，
            以后要放开别的开本，把这段渲染回来即可。 */}

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
          onClick={() => {
            setOpened(false) // 从编辑器生成：先给一本合着的书，点一下才翻开
            generate()
          }}
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
