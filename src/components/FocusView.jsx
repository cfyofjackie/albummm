import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import AlbumPage from './AlbumPage.jsx'
import './focus.css'

// Focus View：放大阅读书的单页。物理正确的书页几何：
// - 右页（recto）靠右放，书脊在其左侧，同 spread 的左页从左侧露出一小条
// - 左页（verso）镜像：靠左放，书脊在右，右页从右侧露出
// - 页面沿书的连续书芯横向滑动（scroll-snap），背景与 Book View 完全一致（纸色）
// 进出场为 FLIP 缩放：从被点页面在书中的实际位置放大/缩回，无界面切换感。
const FocusView = forwardRef(function FocusView(
  { album, index, onIndexChange, onCloseRequest, onClosed, sourceRect },
  ref,
) {
  const trackRef = useRef(null)
  const touchStart = useRef(null)
  const closingRef = useRef(false)

  const total = album.pages.length
  const sideOf = (f) => {
    if (f === 0) return 'right'
    if (f === total - 1) return 'left'
    return f % 2 === 1 ? 'left' : 'right'
  }

  const activeWrap = () => trackRef.current?.children[index] ?? null

  // 入场：定位到当前页，然后从书中被点页面的矩形放大过来
  useEffect(() => {
    const track = trackRef.current
    const wrap = track.children[index]
    if (!wrap) return
    wrap.scrollIntoView({ inline: sideOf(index) === 'right' ? 'end' : 'start', block: 'nearest' })
    const pageEl = wrap.querySelector('.album-page')
    if (!pageEl || !sourceRect) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const last = pageEl.getBoundingClientRect()
    const dx = sourceRect.left + sourceRect.width / 2 - (last.left + last.width / 2)
    const dy = sourceRect.top + sourceRect.height / 2 - (last.top + last.height / 2)
    const sx = sourceRect.width / last.width
    const sy = sourceRect.height / last.height

    track.classList.add('is-entering')
    wrap.classList.add('is-morphing')
    pageEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
    void pageEl.offsetWidth // 先呈现起始状态，再加过渡类
    pageEl.classList.add('morph-anim')
    pageEl.style.transform = ''
    pageEl.addEventListener(
      'transitionend',
      (e) => {
        if (e.target !== pageEl) return
        pageEl.classList.remove('morph-anim')
        wrap.classList.remove('is-morphing')
        track.classList.remove('is-entering')
      },
      { once: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    // 退出：把当前页缩回到书中目标矩形；动画结束由外层卸载 Focus
    playClose(targetRect) {
      if (closingRef.current) return
      closingRef.current = true
      const wrap = activeWrap()
      const pageEl = wrap?.querySelector('.album-page')
      if (!pageEl || !targetRect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        onClosed()
        return
      }
      const track = trackRef.current
      const first = pageEl.getBoundingClientRect()
      const dx = targetRect.left + targetRect.width / 2 - (first.left + first.width / 2)
      const dy = targetRect.top + targetRect.height / 2 - (first.top + first.height / 2)
      const sx = targetRect.width / first.width
      const sy = targetRect.height / first.height

      track.classList.add('is-entering')
      wrap.classList.add('is-morphing')
      pageEl.classList.add('morph-anim')
      void pageEl.offsetWidth
      pageEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
      pageEl.addEventListener(
        'transitionend',
        (e) => {
          if (e.target !== pageEl) return
          onClosed()
        },
        { once: true },
      )
    },
  }))

  const handleScroll = () => {
    const track = trackRef.current
    const vw = track.clientWidth
    const left = track.scrollLeft
    // 与视口重叠最大的页即当前页（snap 位置按页的左右侧偏移，不能用居中近似）
    let best = index
    let bestOverlap = -1
    for (let i = 0; i < track.children.length; i++) {
      const r = track.children[i].getBoundingClientRect()
      const overlap = Math.min(r.right, vw) - Math.max(r.left, 0)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = i
      }
    }
    void left
    if (best !== index) onIndexChange(best)
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
    if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.2) onCloseRequest()
  }

  const handleWrapClick = (e, i) => {
    e.stopPropagation()
    if (i === index) {
      onCloseRequest() // 点当前页 → 缩回书
    } else {
      // 点露出的邻页 → 滑过去看它
      trackRef.current.children[i].scrollIntoView({
        inline: sideOf(i) === 'right' ? 'end' : 'start',
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }

  return (
    <div className="zfocus">
      <div
        className="zfocus__track"
        ref={trackRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          e.stopPropagation()
          if (!e.target.closest('.zfocus__page-wrap')) onCloseRequest()
        }}
      >
        {album.pages.map((p, i) => (
          <div
            key={i}
            className={`zfocus__page-wrap ${sideOf(i) === 'right' ? 'is-recto' : 'is-verso'}`}
            onClick={(e) => handleWrapClick(e, i)}
          >
            <AlbumPage page={p} album={album} />
          </div>
        ))}
      </div>
      <div className="zfocus__counter">
        {index + 1} / {total}
      </div>
      <button type="button" className="zfocus__close" aria-label="缩回书本" onClick={onCloseRequest}>
        ✕
      </button>
    </div>
  )
})

export default FocusView
