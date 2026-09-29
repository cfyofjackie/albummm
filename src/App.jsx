import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import HomePage from './home/HomePage.jsx'
import PrimaryNav from './home/PrimaryNav.jsx'
import WorksPage from './home/WorksPage.jsx'

// 应用缝隙：这个文件只决定「当前显示哪个页面」。
// 正式入口是两条 hash 路由（#/story 多页故事、#/collage 单张拼贴），地址稳定可分享；
// 旧 ?prototype= 链接保留为开发与兼容入口。所有版本都按需加载，首页不引入任何历史原型。
const PROTOTYPES = {
  'v1-book': lazy(() => import('./v1-book/V1BookApp.jsx')),
  'collage-masters': lazy(() => import('./v2-collage/prototypes/CollageMastersPrototype.jsx')),
  'collage-interaction': lazy(() => import('./v2-collage/prototypes/CollageInteractionPrototype.jsx')),
  'collage-flow': lazy(() => import('./v2-collage/prototypes/CollageFlowPrototype.jsx')),
  'carousel-masters': lazy(() => import('./v3-carousel/prototypes/CarouselMastersPrototype.jsx')),
  'carousel-scatter': lazy(() => import('./v3-carousel/prototypes/CarouselScatterPrototype.jsx')),
  'carousel-rhythm': lazy(() => import('./v3-carousel/prototypes/CarouselRhythmPrototype.jsx')),
  'carousel-smart': lazy(() => import('./v3-carousel/prototypes/CarouselSmartPrototype.jsx')),
  'carousel-scale': lazy(() => import('./v3-carousel/prototypes/CarouselScalePrototype.jsx')),
  'v4-gallery': lazy(() => import('./v4-gallery/V4GalleryPrototype.jsx')),
  'v5-reference-layout': lazy(() => import('./v5-collage/V5CollagePrototype.jsx')),
}

const ROUTES = { story: 'carousel-smart', collage: 'v5-reference-layout', works: 'works' }

// hash 一旦出现就以它为准（首页链接写成 #/，这样才能从带 ?prototype= 的页面回到首页）；
// 没有 hash 时才回退读取旧参数。
function currentRoute() {
  const { hash, search } = window.location
  if (hash && hash !== '#') {
    const path = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '')
    return ROUTES[path] ?? null
  }
  const prototype = new URLSearchParams(search).get('prototype')
  return prototype && prototype in PROTOTYPES ? prototype : null
}

// 首页与「我的作品」是双面板横向轨道：拖动时面板跟手（rAF 批量写 transform），
// 松手后弹簧动画落到目标页并同步 hash 与底部导航滑块。机制与胶卷项目一致。
export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const navRef = useRef(null)
  const thumbRef = useRef(null)
  const homePanelRef = useRef(null)
  const worksPanelRef = useRef(null)
  const widthRef = useRef(390)
  const offsetRef = useRef(0)
  const dragFrameRef = useRef(undefined)
  const pendingDragRef = useRef(null)
  const settleFrameRef = useRef(undefined)
  const settleTargetRef = useRef(null)
  const swipeRef = useRef(null)
  const swallowClickRef = useRef(false)
  const swallowTimerRef = useRef(undefined)
  const routeRef = useRef(route)
  useLayoutEffect(() => { routeRef.current = route }, [route])

  const primary = route === null ? 'home' : route === 'works' ? 'works' : null

  const pageWidth = useCallback(() => widthRef.current, [])

  const setPanelAccess = useCallback((index) => {
    if (homePanelRef.current) homePanelRef.current.inert = index === 1
    if (worksPanelRef.current) worksPanelRef.current.inert = index === 0
  }, [])

  // offset 同时驱动轨道位移与导航滑块：滑块按页面进度平移 56px。
  const setOffset = useCallback((next) => {
    const width = pageWidth()
    const x = Math.max(-width, Math.min(0, next))
    offsetRef.current = x
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${x}px, 0, 0)`
    if (thumbRef.current) thumbRef.current.style.transform = `translate3d(${(-x / width) * 56}px, 0, 0)`
    if (navRef.current) {
      const visual = x < -width / 2 ? 'works' : 'home'
      if (navRef.current.dataset.visual !== visual) navRef.current.dataset.visual = visual
    }
  }, [pageWidth])

  const cancelDragFrame = useCallback(() => {
    if (dragFrameRef.current !== undefined) cancelAnimationFrame(dragFrameRef.current)
    dragFrameRef.current = undefined
    pendingDragRef.current = null
  }, [])

  const flushDragFrame = useCallback(() => {
    if (dragFrameRef.current !== undefined) cancelAnimationFrame(dragFrameRef.current)
    dragFrameRef.current = undefined
    const next = pendingDragRef.current
    pendingDragRef.current = null
    if (next !== null) setOffset(next)
  }, [setOffset])

  const queueDragOffset = useCallback((next) => {
    pendingDragRef.current = next
    if (dragFrameRef.current !== undefined) return
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = undefined
      const latest = pendingDragRef.current
      pendingDragRef.current = null
      if (latest !== null) setOffset(latest)
    })
  }, [setOffset])

  const stopSettling = useCallback(() => {
    if (settleFrameRef.current !== undefined) cancelAnimationFrame(settleFrameRef.current)
    settleFrameRef.current = undefined
  }, [])

  const syncHash = useCallback((index) => {
    const target = index === 0 ? '#/' : '#/works'
    if (window.location.hash !== target) window.history.replaceState(null, '', target)
    setRoute(index === 0 ? null : 'works')
  }, [])

  // 弹簧回弹/切换：加速度正比于剩余距离、阻尼正比于速度，快甩可以带着初速度滑入。
  const animateTo = useCallback((index, initialVelocity = 0) => {
    cancelDragFrame()
    stopSettling()
    settleTargetRef.current = index
    setPanelAccess(null)
    const destination = () => -pageWidth() * index
    const finish = () => {
      setOffset(destination())
      setPanelAccess(index)
      settleFrameRef.current = undefined
      settleTargetRef.current = null
      const expected = index === 0 ? null : 'works'
      if (routeRef.current !== expected) syncHash(index)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(offsetRef.current - destination()) < 0.5) {
      finish()
      return
    }
    let velocity = Math.max(-1800, Math.min(1800, initialVelocity))
    let last = performance.now()
    const start = last
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.032)
      last = now
      const target = destination()
      const acceleration = -240 * (offsetRef.current - target) - 30 * velocity
      velocity += acceleration * dt
      const next = offsetRef.current + velocity * dt
      if ((index === 0 && next >= 0) || (index === 1 && next <= target)) { finish(); return }
      setOffset(next)
      if ((Math.abs(offsetRef.current - target) < 2 && Math.abs(velocity) < 24) || now - start > 520) finish()
      else settleFrameRef.current = requestAnimationFrame(tick)
    }
    settleFrameRef.current = requestAnimationFrame(tick)
  }, [cancelDragFrame, pageWidth, setOffset, setPanelAccess, stopSettling, syncHash])

  useLayoutEffect(() => {
    if (!primary) {
      stopSettling()
      settleTargetRef.current = null
      swipeRef.current = null
      return
    }
    widthRef.current = viewportRef.current?.clientWidth || 390
    if (settleFrameRef.current === undefined && !swipeRef.current) setOffset(primary === 'works' ? -pageWidth() : 0)
  }, [pageWidth, primary, setOffset, stopSettling])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      widthRef.current = entries[0]?.contentRect.width || node.clientWidth || 390
      if (swipeRef.current || settleFrameRef.current !== undefined) return
      setOffset(primary === 'works' ? -pageWidth() : 0)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [pageWidth, primary, setOffset])

  useEffect(() => () => {
    cancelDragFrame()
    stopSettling()
    window.clearTimeout(swallowTimerRef.current)
  }, [cancelDragFrame, stopSettling])

  const navigatePrimary = useCallback((target) => {
    animateTo(target === 'home' ? 0 : 1)
  }, [animateTo])

  // hashchange 服务于浏览器前进/后退、创作页的「← 首页」链接等外部导航；
  // pager 自己的落位用 replaceState 同步 hash，不会触发本监听，避免循环。
  useEffect(() => {
    const sync = () => setRoute(currentRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const onPointerDown = (event) => {
    if (!primary || !event.isPrimary || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('.primary-nav, button, input, textarea, select')) return
    if (event.pointerType === 'mouse' && event.target.closest('a, img')) event.preventDefault()
    const resumeTarget = settleTargetRef.current
    swipeRef.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY, startOffset: offsetRef.current,
      lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, captured: false, resumeTarget,
    }
  }

  const onPointerMove = (event) => {
    const start = swipeRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const width = pageWidth()
    const towardOtherPage = (start.startOffset > -1 && dx < 0) || (start.startOffset < -width + 1 && dx > 0) || (start.startOffset <= -1 && start.startOffset >= -width + 1)
    if (!start.captured && towardOtherPage && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      start.captured = true
      stopSettling()
      settleTargetRef.current = null
      start.startOffset = offsetRef.current
      setPanelAccess(null)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (!start.captured) return
    event.preventDefault()
    const elapsed = event.timeStamp - start.lastTime
    if (elapsed > 0) start.velocity = start.velocity * 0.55 + ((event.clientX - start.lastX) / elapsed) * 0.45
    start.lastX = event.clientX
    start.lastTime = event.timeStamp
    queueDragOffset(start.startOffset + dx)
  }

  const onPointerUp = (event) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || start.pointerId !== event.pointerId) return
    if (!start.captured) return
    flushDragFrame()
    event.preventDefault()
    // 拖动后的同一次释放可能落在作品卡片上：吞掉这次 click，避免误点进作品。
    swallowClickRef.current = true
    window.clearTimeout(swallowTimerRef.current)
    swallowTimerRef.current = window.setTimeout(() => { swallowClickRef.current = false }, 150)
    const width = pageWidth()
    const progress = -offsetRef.current / width
    const distance = event.clientX - start.x
    const releaseVelocity = event.timeStamp - start.lastTime < 100 ? start.velocity : 0
    const fast = Math.abs(distance) > 24 && Math.abs(releaseVelocity) > 0.45
    const destination = fast ? (start.velocity < 0 ? 1 : 0)
      : start.startOffset > -1 ? (progress > 0.25 ? 1 : 0)
        : start.startOffset < -width + 1 ? (progress < 0.75 ? 0 : 1)
          : (progress >= 0.5 ? 1 : 0)
    animateTo(destination, releaseVelocity * 1000)
  }

  const onPointerCancel = () => {
    const start = swipeRef.current
    swipeRef.current = null
    cancelDragFrame()
    if (start?.captured) animateTo(start.resumeTarget ?? (routeRef.current === 'works' ? 1 : 0))
  }

  const onClickCapture = (event) => {
    if (!swallowClickRef.current) return
    swallowClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const Page = route === 'works' ? WorksPage : PROTOTYPES[route]
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDragStart={(event) => { if (primary && swipeRef.current) event.preventDefault() }}
      onClickCapture={onClickCapture}
    >
      {primary && (
        <div className="primary-viewport" ref={viewportRef}>
          <div className="primary-track" ref={trackRef}>
            <div className="primary-panel" ref={homePanelRef} inert={primary !== 'home'} aria-hidden={primary !== 'home'}><HomePage /></div>
            <div className="primary-panel" ref={worksPanelRef} inert={primary !== 'works'} aria-hidden={primary !== 'works'}><WorksPage /></div>
          </div>
        </div>
      )}
      {route && route !== 'works' && (
        <Suspense fallback={<p className="app-loading">正在载入…</p>}>
          <Page />
        </Suspense>
      )}
      {primary && <PrimaryNav active={primary} navRef={navRef} thumbRef={thumbRef} onHome={() => navigatePrimary('home')} onWorks={() => navigatePrimary('works')} />}
    </div>
  )
}
