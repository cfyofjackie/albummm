import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import AlbumPage from './AlbumPage.jsx'
import { BLANK_PAGE, buildLeaves, flatIndexOf } from '../lib/book.js'
import './book.css'

// 书本视图：整本 8:5 spread + 绕书脊的刚性 3D 翻页。
// 受控组件：leafIndex 由外层持有（Focus View 退出后恢复位置），
// go() / getSpreadRects() 通过 ref 暴露给控制栏 / 键盘 / Focus 动画。
const BookView = forwardRef(function BookView(
  { album, leafIndex, onLeafChange, onPageOpen },
  ref,
) {
  const leaves = useMemo(() => buildLeaves(album.pages), [album])
  const [anim, setAnim] = useState(null) // { dir: 'next' | 'prev', to }
  const rootRef = useRef(null)
  const animTimerRef = useRef(null)
  const touchStart = useRef(null)
  const swiped = useRef(false)

  // 封面在右（书正面）、封底在左（书背面）
  const displaySpread = (i) => {
    if (i === 0) return { left: BLANK_PAGE, right: leaves[0][0] }
    if (i === leaves.length - 1) return { left: leaves[i][0], right: BLANK_PAGE }
    const l = leaves[i]
    return { left: l[0], right: l[1] ?? BLANK_PAGE }
  }

  const commitAnim = (to) => {
    clearTimeout(animTimerRef.current)
    animTimerRef.current = null
    onLeafChange(to)
    setAnim(null)
  }

  const go = (dir) => {
    if (anim) return
    const to = leafIndex + dir
    if (to < 0 || to >= leaves.length) return
    setAnim({ dir: dir > 0 ? 'next' : 'prev', to })
    // 页面被节流时 animationend 可能不触发，超时兜底防止卡在合成帧
    clearTimeout(animTimerRef.current)
    animTimerRef.current = setTimeout(() => commitAnim(to), 800)
  }

  // Focus 进出场需要同时对齐当前 spread 的两页。只传被点页的矩形时，
  // 另一页只能靠遮罩交接，视觉上会像晚加载。
  const getSpreadRects = () => ['left', 'right'].flatMap((side) => {
    const flat = flatIndexOf(leaves, leafIndex, side, album.pages.length)
    if (flat == null) return []
    const pageEl = rootRef.current?.querySelector(
      `.book__half--${side} .album-page`,
    )
    const rect = pageEl?.getBoundingClientRect()
    return rect ? [{ flat, rect }] : []
  })

  useImperativeHandle(ref, () => ({ go, getSpreadRects }))

  const cur = displaySpread(leafIndex)
  const target = anim ? displaySpread(anim.to) : null
  // 翻页期间底下的合成 spread：next 翻出右页时右侧已就位目标右页；prev 对称
  const base = anim
    ? anim.dir === 'next'
      ? { left: cur.left, right: target.right }
      : { left: target.left, right: cur.right }
    : cur
  const leafFace = anim
    ? anim.dir === 'next'
      ? { front: cur.right, back: target.left }
      : { front: cur.left, back: target.right }
    : null

  const handleHalfClick = (side, e) => {
    if (swiped.current || anim) return
    const imageBox = e.target.closest('.imgbox')
    if (imageBox) {
      // 任何照片（含跨中缝的跨页主图 / 横幅 / 三联中图）都进入它所在的那一页：
      // 与双图白边页完全同一套放大阅读，点了哪张就把视点落到哪张，横滑换 spread。
      // 跨页在这里只影响排版，不影响「点开」的行为——不再有中缝热区或单张独立照片。
      const flat = flatIndexOf(leaves, leafIndex, side, album.pages.length)
      if (flat != null) {
        onPageOpen(flat, getSpreadRects(), imageBox.dataset.photoId ?? null)
        return
      }
    }
    go(side === 'left' ? -1 : 1)
  }

  const onTouchStart = (e) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    swiped.current = false
  }

  const onTouchEnd = (e) => {
    if (!touchStart.current || anim) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swiped.current = true
      go(dx < 0 ? 1 : -1)
    }
  }

  return (
    <div
      ref={rootRef}
      className="book-stage"
      style={{ '--spread-ratio': album.format.spreadRatio, '--spread-scale': album.format.aspect * 2 }}
      tabIndex="0"
      aria-label="相册书本。点最外侧边缘或使用方向键翻页，点照片可放大查看。"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="book">
        <div
          className="book__half book__half--left"
          onClick={(e) => handleHalfClick('left', e)}
        >
          <AlbumPage page={base.left} album={album} />
          <div className="book__gutter book__gutter--right-edge" />
        </div>
        <div
          className="book__half book__half--right"
          onClick={(e) => handleHalfClick('right', e)}
        >
          <AlbumPage page={base.right} album={album} />
          <div className="book__gutter book__gutter--left-edge" />
        </div>
        <div className="book__spine" />

        {/* 翻页热区独立覆盖在书口，满版照片也不会吞掉翻页操作。 */}
        <button
          type="button"
          className="book__nav-hit book__nav-hit--prev"
          aria-label="上一页"
          disabled={anim || leafIndex === 0}
          onClick={() => go(-1)}
        />
        <button
          type="button"
          className="book__nav-hit book__nav-hit--next"
          aria-label="下一页"
          disabled={anim || leafIndex === leaves.length - 1}
          onClick={() => go(1)}
        />

        {anim && (
          <div
            className={`book__leaf book__leaf--${anim.dir}`}
            onAnimationEnd={(e) => {
              // 只认 leaf 自身的 transform 动画结束（防其他动画事件冒泡误触发）
              if (e.target === e.currentTarget && anim) commitAnim(anim.to)
            }}
          >
            <div className="book__face book__face--front">
              <AlbumPage page={leafFace.front} album={album} />
            </div>
            <div className="book__face book__face--back">
              <AlbumPage page={leafFace.back} album={album} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default BookView
