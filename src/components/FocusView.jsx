import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import AlbumPage from './AlbumPage.jsx'
import './focus.css'

// Focus View：放大阅读书的单页。物理正确的书页几何：
// - 右页（recto）靠左放，书脊在其左侧，同 spread 的左页从左侧露出一小条
// - 左页（verso）镜像：靠右放，书脊在其右侧，右页从右侧露出
// - 页面沿书的连续书芯横向滑动，底层纸色与 Book View 完全一致
// 进出场为双页独立 FLIP：当前 spread 的两页都从书中的实际位置放大/缩回。
// 分层要点：缩放只作用于 track（页面全程不透明），纸色底与控件单独淡入淡出——
// 入场时书还在，页面像是从书里被拎出来；退场时书在页面落回原位后才露面。
//
// 翻页是自管分页器：手指拖动跟手，松手后无论甩多用力都只翻一页。
// 不用原生 scroll-snap + 惯性——动能会一次滑过好几页，且 CSS 无法限制。
const SWIPE_THRESHOLD = 48 // px，横向位移超过才算一次有效翻页手势

const FocusView = forwardRef(function FocusView(
  { album, index, onIndexChange, onCloseRequest, onClosed, sourceSpread, onTriptychDetail },
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

  // 每页独立 FLIP：当前页和同 spread 的另一页都从书中真实矩形出发。
  // 单一的 track transform 只能约束当前页，无法同时对齐另一页。
  const computePageFlip = (flat, targetRect) => {
    const track = trackRef.current
    const wrap = track?.children[flat]
    const pageEl = wrap?.querySelector('.album-page')
    if (!track || !pageEl || !targetRect) return null
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

    const pageRect = pageEl.getBoundingClientRect()
    const s = targetRect.width / pageRect.width
    const dx = targetRect.left + targetRect.width / 2 - (pageRect.left + pageRect.width / 2)
    const dy = targetRect.top + targetRect.height / 2 - (pageRect.top + pageRect.height / 2)
    return {
      wrap,
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
    }
  }

  const clearPageFlips = (keepTransform) => {
    const track = trackRef.current
    if (!track) return
    Array.from(track.children).forEach((wrap) => {
      wrap.classList.remove('morph-prep', 'morph-anim')
      if (!keepTransform) {
        wrap.classList.remove(
          'morph-page',
          'morph-active',
          'morph-hidden',
        )
        wrap.style.transform = ''
      }
    })
  }

  // 入场：定位到当前页，然后当前 spread 的两页从书中真实位置连续展开。
  // 必须用 useLayoutEffect：初始 transform 要在浏览器绘制第一帧之前就位。
  useLayoutEffect(() => {
    const track = trackRef.current
    const wrap = track?.children[index]
    if (!wrap) return
    positionAt(index)
    if (enteredRef.current) return // StrictMode 下 effect 会跑两遍，防重入
    enteredRef.current = true

    const flips = (sourceSpread ?? [])
      .map(({ flat, rect }) => computePageFlip(flat, rect))
      .filter(Boolean)
    if (flips.length === 0) {
      rootRef.current?.classList.add('is-open')
      return
    }

    const visibleWraps = new Set(flips.map(({ wrap: item }) => item))
    Array.from(track.children).forEach((item) => {
      if (!visibleWraps.has(item)) item.classList.add('morph-hidden')
    })
    flips.forEach(({ wrap: item, transform }) => {
      item.classList.add('morph-page', 'morph-prep')
      item.style.transform = transform
    })
    wrap.classList.add('morph-active')
    void track.offsetWidth // 强制回流，固化两页各自的书中起始态
    flips.forEach(({ wrap: item }) => {
      item.classList.add('morph-anim')
      item.style.transform = ''
    })

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
      clearPageFlips(false)
    }
    wrap.addEventListener('transitionend', (e) => {
      if (e.target === wrap && e.propertyName === 'transform') finish()
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
    // 退出：当前 spread 的两页分别缩回书中目标矩形；动画结束由外层卸载 Focus
    playClose(targetSpread) {
      if (closingRef.current) return
      closingRef.current = true
      const wrap = activeWrap()
      const pageEl = wrap?.querySelector('.album-page')
      if (!pageEl) {
        onClosed()
        return
      }
      const flips = (targetSpread ?? [])
        .map(({ flat, rect }) => computePageFlip(flat, rect))
        .filter(Boolean)
      if (flips.length === 0) {
        onClosed()
        return
      }
      const track = trackRef.current
      const root = rootRef.current
      // 底与控件先退，页面在缩回途中保持不透明：底下的书只在页面快落回原位时才透出
      root?.classList.remove('is-open')
      root?.classList.add('is-closing')
      const visibleWraps = new Set(flips.map(({ wrap: item }) => item))
      Array.from(track.children).forEach((item) => {
        if (!visibleWraps.has(item)) item.classList.add('morph-hidden')
      })
      flips.forEach(({ wrap: item }) => item.classList.add('morph-page', 'morph-prep'))
      wrap.classList.add('morph-active')
      void track.offsetWidth
      flips.forEach(({ wrap: item, transform }) => {
        item.classList.add('morph-anim')
        item.style.transform = transform
      })

      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        // 保留终态 transform（已是书中位置），等卸载，避免闪回
        clearPageFlips(true)
        onClosed()
      }
      // transitionend 在页面被节流等情况下可能不触发，超时兜底
      wrap.addEventListener('transitionend', (e) => {
        if (e.target === wrap && e.propertyName === 'transform') finish()
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
    const page = album.pages[i]
    const triptychPhoto = e.target.closest('.studio-box--triptych[data-photo-id]')

    // 三联图仍是两张物理相纸，而不是三张独立图片：当前纸上的主图点按缩回；
    // 中图经过书脊，进入自己的跨中缝细看；左右图才按相邻物理页平滑移动。
    if (triptychPhoto && page?.type === 'studio' && page.layoutId === 'studio-triptych') {
      const photoPosition = page.studio.imageIds.indexOf(triptychPhoto.dataset.photoId)
      if (photoPosition === 1) {
        onTriptychDetail?.(i, triptychPhoto.dataset.photoId, triptychPhoto.getBoundingClientRect())
        return
      }
      const direction = page.studio.side === 'left'
        ? (photoPosition > 0 ? 1 : 0)
        : (photoPosition < page.studio.imageIds.length - 1 ? -1 : 0)
      const next = Math.max(0, Math.min(total - 1, i + direction))
      if (next !== i) {
        onIndexChange(next)
        positionAt(next, 'smooth')
        return
      }
    }

    if (i === indexRef.current) {
      onCloseRef.current() // 点当前页 → 缩回书
    } else {
      onIndexChange(i)
      positionAt(i, 'smooth') // 点露出的邻页 → 滑过去看它
    }
  }

  return (
    <div
      className="zfocus"
      ref={rootRef}
      style={{ '--focus-scale': album.format.focusScale }}
    >
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
