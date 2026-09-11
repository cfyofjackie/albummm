import { useEffect, useMemo, useRef, useState } from 'react'
import BookView from './BookView.jsx'
import FocusView from './FocusView.jsx'
import { buildLeaves } from '../lib/book.js'
import './reader.css'

const STYLE_OPTIONS = [
  { id: 'gallery', name: 'Gallery' },
  { id: 'rhythm', name: 'Rhythm' },
  { id: 'frame', name: 'Frame' },
]

export default function AlbumViewer({ album, onBack, onRegenerate, onStyleChange }) {
  const [leafIndex, setLeafIndex] = useState(0)
  const [focusIndex, setFocusIndex] = useState(null)
  const [uiVisible, setUiVisible] = useState(true)
  const bookRef = useRef(null)
  const leaves = useMemo(() => buildLeaves(album.pages), [album])

  // 换书（重生成 / 切风格）回到封面，退出 Focus
  useEffect(() => {
    setLeafIndex(0)
    setFocusIndex(null)
  }, [album])

  useEffect(() => {
    const onKey = (e) => {
      if (focusIndex != null) return
      if (e.key === 'ArrowRight') bookRef.current?.go(1)
      if (e.key === 'ArrowLeft') bookRef.current?.go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusIndex])

  return (
    <div className="reader" onClick={() => setUiVisible((v) => !v)}>
      {focusIndex == null ? (
        <BookView
          ref={bookRef}
          album={album}
          leafIndex={leafIndex}
          onLeafChange={setLeafIndex}
          onPageOpen={setFocusIndex}
        />
      ) : (
        <FocusView
          album={album}
          index={focusIndex}
          onIndexChange={setFocusIndex}
          onClose={() => setFocusIndex(null)}
        />
      )}

      <div
        className={`reader__bar ${uiVisible ? '' : 'reader__bar--hidden'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="reader__count">
          {leafIndex + 1} / {leaves.length}
        </span>
        <span className="reader__sep" />
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
        <span className="reader__sep" />
        <button type="button" className="chip" onClick={onRegenerate}>
          重新生成
        </button>
        <button type="button" className="chip" onClick={onBack}>
          返回编辑
        </button>
      </div>
    </div>
  )
}
