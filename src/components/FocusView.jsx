import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import AlbumPage from './AlbumPage.jsx'
import './focus.css'

// Focus View：放大阅读书的单页。物理正确的书页几何：
// - 右页（recto）靠左放，书脊在其左侧，同 spread 的左页从左侧露出一小条
// - 左页（verso）镜像：靠右放，书脊在其右侧，右页从右侧露出
// - 页面沿书的连续书芯横向滑动，底层纸色与 Book View 完全一致
// 进出场为容器级 FLIP：整条书芯从被点页面在书中的实际位置放大/缩回。
// 分层要点：缩放只作用于 track（页面全程不透明），纸色底与控件单独淡入淡出——
// 入场时书还在，页面像是从书里被拎出来；退场时书在页面落回原位后才露面。
//
// 翻页是自管分页器：手指拖动跟手，松手后无论甩多用力都只翻一页。
// 不用原生 scroll-snap + 惯性——动能会一次滑过好几页，且 CSS 无法限制。
const SWIPE_THRESHOLD = 48 // px，横向位移超过才算一次有效翻页手势

const FocusView = forwardRef(function FocusView(
  { album, index, onIndexChange, onCloseRequest, onClosed, sourceRect },
  ref,
) {
  const rootRef = useRef(null)
  const trackRef = useRef(null)
  const touchRef = useRef(null)
  const closingRef = useRef(false)
  const enteredRef = useRef(false)
  const indexRef = useRef(index)
  indexRef.current = index
  const onCloseRef = useRef(onCloseRequest)
  onCloseRef.current = onCloseRequest

  const total = album.pages.length
  const sideOf = (f) => {
    if (f === 0) return 'right'
    if (f === total - 1) return 'left'
    return f % 2 === 1 ? 'left' : 'right'
  }

  const activeWrap = () => trackRef.current?.children[indexRef.current] ?? null

  // 把第 i 页摆到它的阅读位（recto 贴左缘留 edge、verso 贴右缘留 edge，见 CSS scroll-margin）
  const positionAt = (i, behavior = 'auto') => {
    const track = trackRef.current
    const wrap = track?.children[i]
    if (!track || !wrap) return
    const cs = getComputedStyle(wrap)
    const target =
      sideOf(i) === 'right'
        ? wrap.offsetLeft - parseFloat(cs.scrollMarginLeft)
        : wrap.offsetLeft + wrap.offsetWidth + parseFloat(cs.scrollMarginRight) - track.clientWidth
    track.scrollTo({ left: Math.max(0, target), behavior })
  }

  // 翻页：无论手势多用力，一次只走一页
  const go = (delta) => {
    const next = Math.max(0, Math.min(total - 1, indexRef.current + delta))
    if (next === indexRef.current) {
      positionAt(indexRef.current, 'smooth') // 已经是首/末页，弹回当前页
      return
    }
    onIndexChange(next)
    positionAt(next, 'smooth')
  }

  // 容器级 FLIP：让被点页在 track 坐标系里对准 targetRect（书中矩形）
  const computeTrackFlip = (targetRect) => {
    const track = trackRef.current
    const wrap = activeWrap()
    const pageEl = wrap?.querySelector('.album-page')
    if (!track || !pageEl || !targetRect) return null
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

    const pageRect = pageEl.getBoundingClientRect()
    const trackRect = track.getBoundingClientRect()
    const s = targetRect.width / pageRect.width
    const dx = targetRect.left + targetRect.width / 2 - (pageRect.left + pageRect.width / 2)
    const dy = targetRect.top + targetRect.height / 2 - (pageRect.top + pageRect.height / 2)
    return {
      origin: `${pageRect.left + pageRect.width / 2 - trackRect.left}px ${
        pageRect.top + pageRect.height / 2 - trackRect.top
      }px`,
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
    }
  }

  const clearTrackFlip = (keepTransform) => {
    const track = trackRef.current
    if (!track) return
    track.classList.remove('morph-anim', 'morph-prep')
    // 退场结束时保留 transform（已是书中位置），否则卸载前会闪回放大态
    if (!keepTransform) {
      track.style.transform = ''
      track.style.transformOrigin = ''
    }
  }

  // 入场：定位到当前页，然后整条书芯从书中被点页面的矩形连续放大。
  // 必须用 useLayoutEffect：初始 transform 要在浏览器绘制第一帧之前就位。
  useLayoutEffect(() => {
    const track = trackRef.current
    const wrap = track?.children[index]
    if (!wrap) return
    positionAt(index)
    if (enteredRef.current) return // StrictMode 下 effect 会跑两遍，防重入
    enteredRef.current = true

    const pageEl = wrap.querySelector('.album-page')
    if (!pageEl || !sourceRect) return

    const flip = computeTrackFlip(sourceRect)
    if (!flip) return

    track.classList.add('morph-prep') // 先提升合成层，过渡首帧不掉回主线程
    track.style.transformOrigin = flip.origin
    track.style.transform = flip.transform // 起始态（书中位置），此时还没有过渡类
    void track.offsetWidth // 强制回流，固化起始态
    track.classList.add('morph-anim') // 开过渡
    track.style.transform = '' // 连续放大到焦点布局

    // 纸色底淡入盖住底下的书、控件显形（没有这一步，书会透过所有缝隙露出来）
    const root = rootRef.current
    if (root) {
      void root.offsetWidth
      root.classList.add('is-open')
    }

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTrackFlip(false)
    }
    track.addEventListener('transitionend', (e) => {
      if (e.target === track && e.propertyName === 'transform') finish()
    })
    setTimeout(finish, 650) // 节流/丢事件兜底

    // 预解码条带上全部页面图：视口外的图片浏览器会推迟解码，
    // 退出缩放时邻页会以空白页滑入、图片延迟上屏
    track.querySelectorAll('img').forEach((img) => {
      img.decode?.().catch(() => {})
    })
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
      const flip = computeTrackFlip(targetRect)
      if (!flip) {
        onClosed()
        return
      }
      const track = trackRef.current
      const root = rootRef.current
      // 底与控件先退，页面在缩回途中保持不透明：底下的书只在页面快落回原位时才透出
      root?.classList.remove('is-open')
      root?.classList.add('is-closing')
      track.classList.add('morph-prep')
      track.style.transformOrigin = flip.origin
      void track.offsetWidth
      track.classList.add('morph-anim')
      track.style.transform = flip.transform // 从 identity 连续缩回书中位置

      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        // 保留终态 transform（已是书中位置），等卸载，避免闪回
        clearTrackFlip(true)
        onClosed()
      }
      // transitionend 在页面被节流等情况下可能不触发，超时兜底
      track.addEventListener('transitionend', (e) => {
        if (e.target === track && e.propertyName === 'transform') finish()
      })
      setTimeout(finish, 650)
    },
  }))

  // 自管分页手势：横向拖动跟手（禁用原生惯性），松手后无论甩多用力都只翻一页；下滑退出
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const onStart = (e) => {
      const t = e.touches[0]
      touchRef.current = { x: t.clientX, y: t.clientY, scroll: track.scrollLeft, mode: 'pending' }
    }
    const onMove = (e) => {
      const d = touchRef.current
      if (!d) return
      const t = e.touches[0]
      const dx = t.clientX - d.x
      const dy = t.clientY - d.y
      if (d.mode === 'pending') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        d.mode = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'
      }
      if (d.mode === 'horizontal') {
        e.preventDefault() // 接管横向滚动：原生惯性会一次滑过好几页
        track.scrollLeft = d.scroll - dx
      }
      // vertical 模式不拦截，留给 touchend 判定下滑退出
    }
    const onEnd = (e) => {
      const d = touchRef.current
      touchRef.current = null
      if (!d) return
      const t = e.changedTouches[0]
      const dx = t.clientX - d.x
      const dy = t.clientY - d.y
      if (d.mode === 'vertical') {
        if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.2) onCloseRef.current()
        return
      }
      if (d.mode === 'horizontal') {
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          go(dx < 0 ? 1 : -1) // 无论甩多用力，一次只翻一页
        } else {
          positionAt(indexRef.current, 'smooth') // 没过阈值，弹回当前页
        }
      }
    }
    track.addEventListener('touchstart', onStart, { passive: true })
    track.addEventListener('touchmove', onMove, { passive: false })
    track.addEventListener('touchend', onEnd)
    const onCancel = () => {
      touchRef.current = null
    }
    track.addEventListener('touchcancel', onCancel)
    return () => {
      track.removeEventListener('touchstart', onStart)
      track.removeEventListener('touchmove', onMove)
      track.removeEventListener('touchend', onEnd)
      track.removeEventListener('touchcancel', onCancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 窗口尺寸变化后重新对位（页宽用了 vw/dvh，偏移会变）
  useEffect(() => {
    const onResize = () => positionAt(indexRef.current)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWrapClick = (e, i) => {
    e.stopPropagation()
    if (i === indexRef.current) {
      onCloseRef.current() // 点当前页 → 缩回书
    } else {
      onIndexChange(i)
      positionAt(i, 'smooth') // 点露出的邻页 → 滑过去看它
    }
  }

  return (
    <div className="zfocus" ref={rootRef}>
      <div className="zfocus__scrim" />
      <div
        className="zfocus__track"
        ref={trackRef}
        onClick={(e) => {
          e.stopPropagation()
          if (!e.target.closest('.zfocus__page-wrap')) onCloseRef.current()
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
