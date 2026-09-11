import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'
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
  const enteredRef = useRef(false)
  const morphingRef = useRef(false)

  // 容器级 FLIP：transform 作用于整条 track（书芯）。
  // 被点页对准书中矩形后，整个开页（双页 + 中缝 + 露边）作为一个连续对象缩放，
  // 所有页面共享同一个 transform——数学上不可能出现「先放大左边再放大右边」。
  // toTransform 为 null 时表示入场（起点 = 书中矩形，终点 = 焦点布局）。
  const applyTrackFlip = (targetRect, toTransform) => {
    const track = trackRef.current
    const wrap = activeWrap()
    const pageEl = wrap?.querySelector('.album-page')
    if (!track || !pageEl || !targetRect) return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false

    const pageRect = pageEl.getBoundingClientRect()
    const trackRect = track.getBoundingClientRect()
    const s = targetRect.width / pageRect.width
    const dx = targetRect.left + targetRect.width / 2 - (pageRect.left + pageRect.width / 2)
    const dy = targetRect.top + targetRect.height / 2 - (pageRect.top + pageRect.height / 2)

    track.style.transformOrigin = `${pageRect.left + pageRect.width / 2 - trackRect.left}px ${
      pageRect.top + pageRect.height / 2 - trackRect.top
    }px`
    track.classList.add('morph-anim')
    void track.offsetWidth
    track.style.transform = toTransform ?? `translate(${dx}px, ${dy}px) scale(${s})`
    return true
  }

  const clearTrackFlip = () => {
    const track = trackRef.current
    if (!track) return
    track.classList.remove('morph-anim')
    track.style.transform = ''
    track.style.transformOrigin = ''
    morphingRef.current = false
  }

  // 入场：定位到当前页，然后整条书芯从书中被点页面的矩形连续放大。
  // 必须用 useLayoutEffect：初始 transform 要在浏览器绘制第一帧之前就位，
  // 否则会先闪现一帧「最终布局」再跳回起点——看起来就是「分段展开」。
  useLayoutEffect(() => {
    const track = trackRef.current
    const wrap = track?.children[index]
    if (!wrap) return
    wrap.scrollIntoView({ inline: sideOf(index) === 'right' ? 'end' : 'start', block: 'nearest' })
    if (enteredRef.current) return // StrictMode 下 effect 会跑两遍，防重入
    enteredRef.current = true

    const pageEl = wrap.querySelector('.album-page')
    if (!pageEl || !sourceRect) return

    morphingRef.current = true
    const started = applyTrackFlip(sourceRect, null)
    if (!started) {
      morphingRef.current = false
      return
    }
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTrackFlip()
    }
    track.addEventListener('transitionend', (e) => {
      if (e.target === track && e.propertyName === 'transform') finish()
    })
    setTimeout(finish, 500) // 节流/丢事件兜底
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    // 退出：整条书芯缩回到书中目标矩形；动画结束由外层卸载 Focus
    playClose(targetRect) {
      if (closingRef.current) return
      closingRef.current = true
      const wrap = activeWrap()
      const pageEl = wrap?.querySelector('.album-page')
      if (!pageEl || !targetRect) {
        onClosed()
        return
      }
      morphingRef.current = true
      const first = pageEl.getBoundingClientRect()
      const dx = targetRect.left + targetRect.width / 2 - (first.left + first.width / 2)
      const dy = targetRect.top + targetRect.height / 2 - (first.top + first.height / 2)
      const s = targetRect.width / first.width
      const toTransform = `translate(${dx}px, ${dy}px) scale(${s})`

      const started = applyTrackFlip(targetRect, toTransform)
      if (!started) {
        onClosed()
        return
      }
      const track = trackRef.current
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        clearTrackFlip()
        onClosed()
      }
      // animationend 在页面被节流等情况下可能不触发，超时兜底
      track.addEventListener('transitionend', (e) => {
        if (e.target === track && e.propertyName === 'transform') finish()
      })
      setTimeout(finish, 500)
    },
  }))

  const handleScroll = () => {
    if (morphingRef.current) return // 变形中的矩形不代表真实布局，会误判当前页
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
