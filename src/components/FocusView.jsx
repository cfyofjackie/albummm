import { useEffect, useRef } from 'react'
import AlbumPage from './AlbumPage.jsx'
import './focus.css'

// Focus View：单页近全屏横向滑动阅读（scroll-snap），无翻书动画。
// 下滑 / 点空白 / 关闭按钮退出；leaf 位置由外层持有，退出即恢复。
export default function FocusView({ album, index, onIndexChange, onClose }) {
  const trackRef = useRef(null)
  const touchStart = useRef(null)

  useEffect(() => {
    const track = trackRef.current
    const slide = track.children[index]
    if (slide) track.scrollLeft = slide.offsetLeft
    // 仅进入时定位一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScroll = () => {
    const track = trackRef.current
    const i = Math.max(0, Math.min(album.pages.length - 1, Math.round(track.scrollLeft / track.clientWidth)))
    if (i !== index) onIndexChange(i)
  }

  const onTouchStart = (e) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  const onTouchEnd = (e) => {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.4) onClose()
  }

  const handleClick = (e) => {
    // 点页面图片不动，点 slide 内留白 / 深色背景退出
    if (!e.target.closest('.imgbox')) onClose()
  }

  return (
    <div className="focus">
      <div
        className="focus__track"
        ref={trackRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={handleClick}
      >
        {album.pages.map((p, i) => (
          <div className="focus__slide" key={i}>
            <div className="focus__page">
              <AlbumPage page={p} album={album} />
            </div>
          </div>
        ))}
      </div>
      <div className="focus__counter">
        {index + 1} / {album.pages.length}
      </div>
      <button type="button" className="focus__close" aria-label="退出单页阅读" onClick={onClose}>
        ✕
      </button>
    </div>
  )
}
