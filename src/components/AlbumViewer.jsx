import { useEffect, useMemo, useRef, useState } from 'react'
import BookView from './BookView.jsx'
import FocusView from './FocusView.jsx'
import SpreadFocusView from './SpreadFocusView.jsx'
import { BLANK_PAGE, buildLeaves, leafOfFlat } from '../lib/book.js'
import './reader.css'

const STYLE_OPTIONS = [
  { id: 'gallery', name: 'Gallery' },
  { id: 'rhythm', name: 'Rhythm' },
  { id: 'frame', name: 'Frame' },
  { id: 'studio', name: 'Studio' },
]

export default function AlbumViewer({ album, onBack, onRegenerate, onStyleChange, onFormatChange }) {
  const [leafIndex, setLeafIndex] = useState(0)
  const [focusIndex, setFocusIndex] = useState(null)
  const [spreadFocus, setSpreadFocus] = useState(null)
  const [uiVisible, setUiVisible] = useState(true)
  const bookRef = useRef(null)
  const focusRef = useRef(null)
  const spreadRef = useRef(null)
  const sourceSpreadRef = useRef([])
  const closingRef = useRef(false)
  const leaves = useMemo(() => buildLeaves(album.pages), [album])

  // 换书（重生成 / 切风格）回到封面，退出 Focus
  useEffect(() => {
    setLeafIndex(0)
    setFocusIndex(null)
    setSpreadFocus(null)
  }, [album])

  useEffect(() => {
    const onKey = (e) => {
      if (focusIndex != null || spreadFocus != null) return
      if (e.key === 'ArrowRight') bookRef.current?.go(1)
      if (e.key === 'ArrowLeft') bookRef.current?.go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusIndex, spreadFocus])

  const openFocus = (flat, sourceSpread) => {
    sourceSpreadRef.current = sourceSpread
    setFocusIndex(flat)
  }

  // Focus 内再次点到跨中缝的三联中图时，仍停留在当前阅读层的背后；
  // 缩回跨页细看后，用户回到原来的单张相纸，而不是被送回书本。
  const openTriptychDetail = (flat, photoId, sourceRect) => {
    const leaf = leafOfFlat(flat, leaves, album.pages.length)
    const pair = leaves[leaf] ?? []
    setSpreadFocus({
      spread: { left: pair[0] ?? BLANK_PAGE, right: pair[1] ?? BLANK_PAGE },
      photoId,
      sourceRect,
      sourceSpread: [],
    })
  }

  // 跨页退场：先连续缩回书中双页矩形，动画结束才卸载（与单页 Focus 同一套收尾方式）
  const requestCloseSpread = () => {
    spreadRef.current?.playClose()
  }

  // 退出 Focus：先把书摊开到当前页所在 spread（Focus 覆盖着，用户看不到跳变），
  // 再把 Focus 的当前页 FLIP 缩回到书中位置，动画结束后卸载。
  const requestCloseFocus = () => {
    if (focusIndex == null || closingRef.current) return
    closingRef.current = true
    const f = focusIndex
    setLeafIndex(leafOfFlat(f, leaves, album.pages.length))
    requestAnimationFrame(() => {
      const targetSpread = bookRef.current?.getSpreadRects() ?? []
      focusRef.current?.playClose(targetSpread)
      closingRef.current = false
    })
  }

  return (
    <div className="reader" onClick={() => setUiVisible((v) => !v)}>
      <BookView
        ref={bookRef}
        album={album}
        leafIndex={leafIndex}
        onLeafChange={setLeafIndex}
        onPageOpen={openFocus}
      />
      {focusIndex != null && (
        <FocusView
          ref={focusRef}
          album={album}
          index={focusIndex}
          onIndexChange={setFocusIndex}
          onCloseRequest={requestCloseFocus}
          onClosed={() => setFocusIndex(null)}
          sourceSpread={sourceSpreadRef.current}
          onTriptychDetail={openTriptychDetail}
        />
      )}
      {spreadFocus != null && (
        <SpreadFocusView
          ref={spreadRef}
          album={album}
          spread={spreadFocus.spread}
          photoId={spreadFocus.photoId}
          sourceRect={spreadFocus.sourceRect}
          sourceSpread={spreadFocus.sourceSpread}
          onClose={requestCloseSpread}
          onClosed={() => setSpreadFocus(null)}
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
        <select
          className="reader__format"
          aria-label="相册开本"
          value={album.format.id}
          onChange={(e) => onFormatChange(e.target.value)}
        >
          <option value="portrait">3:4 竖版</option>
          <option value="landscape">4:3 横版</option>
          <option value="square">1:1 方形</option>
          <option value="editorial">4:5 Editorial</option>
        </select>
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
