import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import AlbumPage from './AlbumPage.jsx'
import './spread-focus.css'

// Studio 跨页的放大阅读。入口只有一个：单页 Focus 里再点跨中缝的中图。
// 两级：
//   1. 跨页查看——整张双页纸放大，中缝、纸面、左右页都在；
//   2. 跨中缝细看——紧接着把那张照片就地放大，中缝仍穿过画面，左右书口退到屏外。
// 两级共用同一个元素与同一条 transform 过渡，所以放大和退回都是连续的；
// 纸色底与控件单独淡入淡出，页面本身始终不透明（避免与底下的书叠成重影）。
const SpreadFocusView = forwardRef(function SpreadFocusView(
  { album, spread, photoId, sourceRect, sourceSpread, onClose, onClosed },
  ref,
) {
  const bookRef = useRef(null)
  const rootRef = useRef(null)
  const readyRef = useRef(false)
  const closingRef = useRef(false)
  const sourceRef = useRef(null)
  const [detail, setDetail] = useState(false)

  // 三联的中间那张是唯一「跨过书脊、可以再放大细看」的照片。
  const triptych = [spread.left, spread.right].find(
    (page) => page?.type === 'studio' && page.layoutId === 'studio-triptych',
  )
  const middlePhotoId = triptych?.studio.imageIds[1] ?? null

  // 未变形的纸面矩形：offset* 不受 transform 影响，退场/二级放大都要用它做基准
  const baseRect = () => {
    const book = bookRef.current
    if (!book) return null
    const { offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height } = book
    return width && height ? { left, top, width, height } : null
  }

  // 从被点的照片 / 整本书的双页矩形出发，展开到阅读尺寸。
  // 这让跨页查看属于同一本书的连续状态，而不是突兀出现的新卡片。
  useLayoutEffect(() => {
    const book = bookRef.current
    if (!book) return
    const target = book.getBoundingClientRect()
    const source = sourceRect ?? (() => {
      const rects = (sourceSpread ?? []).map((item) => item.rect).filter(Boolean)
      if (!rects.length) return null
      const left = Math.min(...rects.map((rect) => rect.left))
      const top = Math.min(...rects.map((rect) => rect.top))
      const right = Math.max(...rects.map((rect) => rect.right))
      const bottom = Math.max(...rects.map((rect) => rect.bottom))
      return { left, top, right, bottom, width: right - left, height: bottom - top }
    })()
    sourceRef.current = source
    if (!source || !target.width || !target.height) {
      rootRef.current?.classList.add('is-open')
      book.classList.add('is-open')
      readyRef.current = true
      return
    }
    const scale = Math.max(0.02, Math.min(1, source.width / target.width, source.height / target.height))
    const dx = source.left + source.width / 2 - (target.left + target.width / 2)
    const dy = source.top + source.height / 2 - (target.top + target.height / 2)
    book.style.setProperty('--spread-enter-x', `${dx}px`)
    book.style.setProperty('--spread-enter-y', `${dy}px`)
    book.style.setProperty('--spread-enter-scale', String(scale))
    book.classList.add('is-entering')
    void book.offsetWidth // 固化书中起点，下一帧才过渡到放大阅读位
    requestAnimationFrame(() => {
      rootRef.current?.classList.add('is-open')
      book.classList.add('is-open')
    })

    let done = false
    const settle = () => {
      if (done) return
      done = true
      // 展开结束后撤掉起始类，之后只由 is-detail / is-closing 决定 transform
      book.classList.remove('is-entering')
      readyRef.current = true
      // 从单页 Focus 点中图进来的（photoId）：跨页只是中转，接着就地放大这张照片
      if (photoId) enterDetailByPhotoId(photoId)
    }
    book.addEventListener('transitionend', (event) => {
      if (event.target === book && event.propertyName === 'transform') settle()
    })
    setTimeout(settle, 650)
  }, [sourceRect, sourceSpread])

  // 把同一张纸就地放大，让某张跨中缝的照片铺满视口。
  // 几何：transform-origin 是纸面中心，照片中心放大后会落在 中心 + k·偏移 处，
  // 再补一个位移把它送回视口中心。
  const enterDetailWith = (target) => {
    const book = bookRef.current
    const box = baseRect()
    if (!book || !target || !box) return false
    const rect = target.getBoundingClientRect()
    if (!rect.width || !rect.height) return false
    const vw = window.innerWidth
    const vh = window.innerHeight
    const k = Math.max(1, Math.min(vw / rect.width, vh / rect.height) * 0.92)
    const dx = vw / 2 - (box.left + box.width / 2) - k * (rect.left + rect.width / 2 - (box.left + box.width / 2))
    const dy = vh / 2 - (box.top + box.height / 2) - k * (rect.top + rect.height / 2 - (box.top + box.height / 2))
    book.style.setProperty('--detail-dx', `${dx}px`)
    book.style.setProperty('--detail-dy', `${dy}px`)
    book.style.setProperty('--detail-k', String(k))
    // 类名走命令式：这个元素上还挂着 is-entering / is-open，交给 React 重渲染会被抹掉
    book.classList.add('is-detail')
    setDetail(true)
    return true
  }

  const enterDetailByPhotoId = (id) => {
    const target = bookRef.current?.querySelector(`.studio-box--triptych[data-photo-id="${id}"]`)
    return target ? enterDetailWith(target) : false
  }

  const enterDetail = (event) => {
    const target = event.target.closest?.('.studio-box--triptych[data-photo-id]')
    if (!target || target.dataset.photoId !== middlePhotoId) return false
    return enterDetailWith(target)
  }

  const exitDetail = () => {
    bookRef.current?.classList.remove('is-detail')
    setDetail(false)
  }

  const handleBookClick = (event) => {
    event.stopPropagation()
    if (closingRef.current) return
    if (detail) {
      exitDetail() // 细看里再点一下 → 退回整跨页
      return
    }
    if (!readyRef.current) return // 展开动画途中不做二级放大，避免量到变形中的矩形
    if (enterDetail(event)) return
    onClose() // 点纸面本身 → 缩回书（与「点当前页缩回」同一套手势语言）
  }

  useImperativeHandle(ref, () => ({
    // 退场：从当前层级（整跨页或细看）连续缩回书中的双页矩形。
    // 起点与入场用的是同一个矩形，所以进出场首尾对齐，交接处看不出切换。
    playClose() {
      if (closingRef.current) return
      closingRef.current = true
      const book = bookRef.current
      const box = baseRect()
      const target = sourceRef.current
      if (!book || !box || !target) {
        onClosed?.()
        return
      }
      const scale = Math.max(0.02, Math.min(1, target.width / box.width, target.height / box.height))
      const dx = target.left + target.width / 2 - (box.left + box.width / 2)
      const dy = target.top + target.height / 2 - (box.top + box.height / 2)
      book.style.setProperty('--exit-x', `${dx}px`)
      book.style.setProperty('--exit-y', `${dy}px`)
      book.style.setProperty('--exit-scale', String(scale))
      rootRef.current?.classList.remove('is-open') // 底与控件先退
      book.classList.add('is-closing') // 页面在缩回途中保持不透明

      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        onClosed?.()
      }
      book.addEventListener('transitionend', (event) => {
        if (event.target === book && event.propertyName === 'transform') finish()
      })
      setTimeout(finish, 650)
    },
  }))

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    // .zspread__book 的类名保持常量：is-entering / is-open / is-detail / is-closing
    // 都是命令式切换的，一旦让 React 重渲染这个元素的 className，它们会被一起抹掉。
    <div
      className="zspread"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="跨页放大查看"
      onClick={(event) => {
        event.stopPropagation()
        if (!detail && !closingRef.current) onClose()
      }}
    >
      <div className="zspread__scrim" />
      <div
        ref={bookRef}
        className="zspread__book"
        style={{
          '--spread-ratio': album.format.spreadRatio,
          '--spread-scale': album.format.aspect * 2,
        }}
        onClick={handleBookClick}
      >
        <div className="zspread__half zspread__half--left">
          <AlbumPage page={spread.left} album={album} />
        </div>
        <div className="zspread__half zspread__half--right">
          <AlbumPage page={spread.right} album={album} />
        </div>
        <div className="zspread__spine" />
      </div>
      <span className="zspread__label">{detail ? '跨中缝细看' : '跨页查看'}</span>
      <button
        type="button"
        className="zspread__close"
        aria-label="缩回书本"
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
      >
        ✕
      </button>
    </div>
  )
})

export default SpreadFocusView
