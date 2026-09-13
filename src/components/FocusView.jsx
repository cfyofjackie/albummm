import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import AlbumPage from './AlbumPage.jsx'
import { buildLeaves, leafOfFlat } from '../lib/book.js'
import './focus.css'

// Focus View：把「书里那一页」放大来读。
// - 页面沿连续书芯横向排布；进出场是双页独立 FLIP，从书中真实矩形连续放大/缩回
// - 点一张照片 = 把它平滑移到画面中心（倍数不变，只移动视点）；再点同一张 = 还原回书
// - 横滑 = 换一个 spread（一次跨两页）；下滑 / 点纸面 / ✕ 也是还原
// 倍数不是写死的数字，而是「页面吃满可用空间」推出来的：窄屏受宽度约束、宽屏受高度约束，
// 于是同一套规则在手机和电脑上自动成立（实测约 1.9× / 1.15×），所有照片共用同一档。
//
// 翻页是自管分页器：手指拖动跟手，松手后无论甩多用力都只换一个 spread。
// 不用原生 scroll-snap + 惯性——动能会一次滑过好几个 spread，且 CSS 无法限制。
const SWIPE_THRESHOLD = 48 // px，横向位移超过才算一次有效换页手势
const PAGE_STEP = 2 // 一次换一个 spread = 跨两页（保持左右手性）
const SPINE_ZONE_MIN = 24 // 书脊判定的最小半径（手指比像素粗）

const FocusView = forwardRef(function FocusView(
  { album, index, onIndexChange, onCloseRequest, onClosed, sourceSpread, sourcePhotoId, sourceNearSpine },
  ref,
) {
  const rootRef = useRef(null)
  const trackRef = useRef(null)
  const touchRef = useRef(null)
  const closingRef = useRef(false)
  const enteredRef = useRef(false)
  const anchorRef = useRef(null) // 当前取景：{ photoId, kind: 'photo' | 'page' | 'spine', pageIndex }
  const indexRef = useRef(index)
  indexRef.current = index
  const onCloseRef = useRef(onCloseRequest)
  onCloseRef.current = onCloseRequest

  const total = album.pages.length
  const leaves = useMemo(() => buildLeaves(album.pages), [album])
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

  // 某张照片在条带里的元素。跨中缝的照片左右两页各渲染一份，取第一个即它在中缝坐标系里的真实位置。
  const photoEl = (id) =>
    (id ? trackRef.current?.querySelector(`[data-photo-id="${id}"]`) ?? null : null)

  // 把某张照片的中心移到视口中心——只移动视点，不动倍数。
  // 这就是「点 9 → 点 7 → 点 2」能平滑移动过去的原因。
  const centerPhoto = (id, behavior = 'auto') => {
    const track = trackRef.current
    if (!track) return false
    const el = photoEl(id)
    if (!el) return false
    const trackRect = track.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const target = track.scrollLeft + (rect.left + rect.width / 2 - trackRect.left) - track.clientWidth / 2
    track.scrollTo({ left: Math.max(0, target), behavior })
    return true
  }

  // 书脊在条带里的位置：当前页的内侧边（recto 的内侧在左，verso 在内侧在右）
  const spineAt = (pageIndex) => {
    const track = trackRef.current
    const wrap = track?.children[pageIndex]
    if (!track || !wrap) return null
    const rect = wrap.getBoundingClientRect()
    const left = track.scrollLeft + rect.left - track.getBoundingClientRect().left
    return sideOf(pageIndex) === 'right' ? left : left + rect.width
  }

  const centerSpine = (pageIndex, behavior = 'auto') => {
    const track = trackRef.current
    const x = spineAt(pageIndex)
    if (!track || x == null) return false
    track.scrollTo({ left: Math.max(0, x - track.clientWidth / 2), behavior })
    return true
  }

  // 点一张照片该落在哪：
  // - 比一页窄的照片（三联左右图 / 三联中图 / 双图白边 / Gallery 各页）→ 居中它自己
  // - 铺满整页的跨页图（跨页主图、超宽横幅）→ 贴书脊看中间，点两侧看那一页
  const anchorFor = (photoId, tapX, pageIndex) => {
    const track = trackRef.current
    const el = photoEl(photoId)
    const wrap = track?.children[pageIndex]
    if (!track || !el || !wrap) return null
    const pageRect = wrap.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    if (rect.width < pageRect.width - 1) return { photoId, kind: 'photo', pageIndex: undefined }
    const spineX = sideOf(pageIndex) === 'right' ? pageRect.left : pageRect.right
    const zone = Math.max(SPINE_ZONE_MIN, pageRect.width * 0.07)
    if (Math.abs(tapX - spineX) <= zone) return { photoId, kind: 'spine', pageIndex }
    return { photoId, kind: 'page', pageIndex }
  }

  const applyAnchor = (anchor, behavior = 'auto') => {
    if (!anchor) return false
    if (anchor.kind === 'photo') return centerPhoto(anchor.photoId, behavior)
    if (anchor.kind === 'spine') return centerSpine(anchor.pageIndex ?? indexRef.current, behavior)
    positionAt(anchor.pageIndex ?? indexRef.current, behavior)
    return true
  }

  // 换 spread：无论手势多用力，一次只走一个 spread（跨两页，左右手性不变）
  const go = (delta) => {
    const next = Math.max(0, Math.min(total - 1, indexRef.current + delta * PAGE_STEP))
    if (next === indexRef.current) {
      applyAnchor(anchorRef.current, 'smooth') // 已经是首/末，弹回原位
      return
    }
    anchorRef.current = null // 换了 spread，取景重新落回整页
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

  // 入场：先把视点落到被点的那张照片上，然后当前 spread 的两页从书中真实位置连续展开。
  // 必须用 useLayoutEffect：初始 transform 要在浏览器绘制第一帧之前就位。
  useLayoutEffect(() => {
    const track = trackRef.current
    const wrap = track?.children[index]
    if (!wrap) return
    if (enteredRef.current) return // StrictMode 下 effect 会跑两遍，防重入
    enteredRef.current = true
    // 定位必须在 FLIP 之前、且只跑一次：StrictMode 的第二次 effect 里页面已经带上
    // 变形 transform，那时再量矩形会得到错的滚动位置（视点会偏半个照片）。
    // 取景由「书里点的是哪张、落在哪」决定：窄照片居中自己；铺满整页的看落点。
    const wrapPage = track.children[index]
    const sourceEl = photoEl(sourcePhotoId)
    const wide = !!sourceEl
      && sourceEl.getBoundingClientRect().width >= wrapPage.getBoundingClientRect().width - 1
    if (!sourcePhotoId) {
      positionAt(index)
    } else if (!wide) {
      anchorRef.current = { photoId: sourcePhotoId, kind: 'photo' }
      centerPhoto(sourcePhotoId)
    } else if (sourceNearSpine) {
      anchorRef.current = { photoId: sourcePhotoId, kind: 'spine', pageIndex: index }
      centerSpine(index)
    } else {
      anchorRef.current = { photoId: sourcePhotoId, kind: 'page', pageIndex: index }
      positionAt(index)
    }
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

  // 自管手势：横向拖动跟手（禁用原生惯性），松手后无论甩多用力都只换一个 spread；下滑退出
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
        e.preventDefault() // 接管横向滚动：原生惯性会一次滑过好几个 spread
        track.scrollLeft = d.scroll - dx
        anchorRef.current = null // 手动拖过之后取景作废，下一次点按重新定位而不是「还原」
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
          go(dx < 0 ? 1 : -1) // 无论甩多用力，一次只换一个 spread
        } else {
          applyAnchor(anchorRef.current, 'smooth') // 没过阈值，弹回当前取景
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
    const onResize = () => applyAnchor(anchorRef.current)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScroll = () => {
    const track = trackRef.current
    if (!track) return
    const vw = track.clientWidth
    // 与视口重叠最大的页即当前页（snap 位置按页的左右侧偏移，不能用居中近似）
    let best = indexRef.current
    let bestOverlap = -1
    for (let i = 0; i < track.children.length; i++) {
      const r = track.children[i].getBoundingClientRect()
      const overlap = Math.min(r.right, vw) - Math.max(r.left, 0)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = i
      }
    }
    if (best !== indexRef.current) onIndexChange(best)
  }

  const handleWrapClick = (e, i) => {
    e.stopPropagation()
    const photoId = e.target.closest('[data-photo-id]')?.dataset.photoId ?? null
    const anchor = photoId ? anchorFor(photoId, e.clientX, i) : null
    const cur = anchorRef.current
    const same = !!anchor && !!cur
      && anchor.photoId === cur.photoId
      && anchor.kind === cur.kind
      && anchor.pageIndex === cur.pageIndex
    // 点了同一个取景 → 还原回书；点了别的照片 / 另一侧 / 书脊 → 平滑换取景
    if (anchor && !same) {
      anchorRef.current = anchor
      applyAnchor(anchor, 'smooth')
      return
    }
    onCloseRef.current()
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
        onScroll={handleScroll}
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
        {leafOfFlat(index, leaves, total) + 1} / {leaves.length}
      </div>
      <button type="button" className="zfocus__close" aria-label="缩回书本" onClick={onCloseRequest}>
        ✕
      </button>
    </div>
  )
})

export default FocusView
