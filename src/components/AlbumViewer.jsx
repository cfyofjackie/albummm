import { useEffect, useState } from 'react'
import AlbumPage from './AlbumPage.jsx'
import './viewer.css'

const STYLE_OPTIONS = [
  { id: 'gallery', name: 'Gallery' },
  { id: 'rhythm', name: 'Rhythm' },
  { id: 'frame', name: 'Frame' },
]

export default function AlbumViewer({ album, onBack, onRegenerate, onStyleChange }) {
  const [index, setIndex] = useState(0)
  const total = album.pages.length

  useEffect(() => {
    setIndex(0)
  }, [album])

  const go = (delta) => setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)))

  return (
    <div className="viewer">
      <div className="viewer__stage">
        <AlbumPage page={album.pages[index]} album={album} />
      </div>

      <div className="viewer__pager">
        <button
          type="button"
          className="pager__btn"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="上一页"
        >
          ←
        </button>
        <span className="pager__count">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          className="pager__btn"
          onClick={() => go(1)}
          disabled={index === total - 1}
          aria-label="下一页"
        >
          →
        </button>
      </div>

      <div className="viewer__actions">
        <div className="viewer__styles" role="radiogroup" aria-label="切换风格">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={album.style === s.id}
              className={`chip ${album.style === s.id ? 'chip--active' : ''}`}
              onClick={() => onStyleChange(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="viewer__meta">
          <button type="button" className="chip" onClick={onRegenerate}>
            重新生成
          </button>
          <button type="button" className="chip" onClick={onBack}>
            返回编辑
          </button>
        </div>
      </div>
    </div>
  )
}
