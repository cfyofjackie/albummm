import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import AlbumPage from './AlbumPage.jsx'
import { BLANK_PAGE, buildLeaves, flatIndexOf } from '../lib/book.js'
import './book.css'

// 书本视图：整本 8:5 spread + 绕书脊的刚性 3D 翻页。
// 受控组件：leafIndex 由外层持有（Focus View 退出后恢复位置），
// go() / getPageRect() 通过 ref 暴露给控制栏 / 键盘 / Focus 动画。
const BookView = forwardRef(function BookView(
  { album, leafIndex, onLeafChange, onPageOpen },
  ref,
) {
  const leaves = useMemo(() => buildLeaves(album.pages), [album])
  const [anim, setAnim] = useState(null) // { dir: 'next' | 'prev', to }
  const rootRef = useRef(null)
  const touchStart = useRef(null)
  const swiped = useRef(false)

  // 封面在右（书正面）、封底在左（书背面）
  const displaySpread = (i) => {
    if (i === 0) return { left: BLANK_PAGE, right: leaves[0][0] }
    if (i === leaves.length - 1) return { left: leaves[i][0], right: BLANK_PAGE }
    const l = leaves[i]
    return { left: l[0], right: l[1] ?? BLANK_PAGE }
  }

  const go = (dir) => {
    if (anim) return
    const to = leafIndex + dir
    if (to < 0 || to >= leaves.length) return
    setAnim({ dir: dir > 0 ? 'next' : 'prev', to })
  }

  // 扁平页码 → 当前 spread 中对应 .album-page 的屏幕矩形（Focus FLIP 动画用）
  const getPageRect = (flat) => {
    const total = album.pages.length
    const isBack = flat >= total - 1
    const isRecto = flat === 0 || (!isBack && flat % 2 === 0)
    const half = rootRef.current?.querySelector(
      isRecto ? '.book__half--right' : '.book__half--left',
    )
    return half?.querySelector('.album-page')?.getBoundingClientRect() ?? null
  }

  useImperativeHandle(ref, () => ({ go, getPageRect }))

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
    if (swiped.current) return
    // 点页面本体 → 带着该页的屏幕矩形进入 Focus View；点留白/书页边缘 → 翻页
    if (e.target.closest('.imgbox')) {
      const flat = flatIndexOf(leaves, leafIndex, side, album.pages.length)
      if (flat != null) {
        const sourceRect = e.target.closest('.album-page')?.getBoundingClientRect() ?? null
        onPageOpen(flat, sourceRect)
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

        {anim && (
          <div
            className={`book__leaf book__leaf--${anim.dir}`}
            onAnimationEnd={() => {
              onLeafChange(anim.to)
              setAnim(null)
            }}
          >
            <div className="book__face book__face--front">
              <AlbumPage page={leafFace.front} album={album} />
              <div className="book__face-shade book__face-shade--front" />
            </div>
            <div className="book__face book__face--back">
              <AlbumPage page={leafFace.back} album={album} />
              <div className="book__face-shade book__face-shade--back" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default BookView
