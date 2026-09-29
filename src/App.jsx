import { lazy, Suspense, useEffect, useRef, useState } from 'react'
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

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const swipe = useRef(null)
  const swallowClick = useRef(false)
  useEffect(() => {
    const sync = () => setRoute(currentRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const primary = route === null ? 'home' : route === 'works' ? 'works' : null
  const onPointerDown = (event) => {
    if (!primary || !event.isPrimary || event.button !== 0 || event.target.closest('.primary-nav, button, input, textarea, select')) return
    if (event.pointerType === 'mouse' && event.target.closest('a, img')) event.preventDefault()
    swipe.current = { x: event.clientX, y: event.clientY, primary, pointerId: event.pointerId, captured: false }
  }
  const onPointerMove = (event) => {
    const start = swipe.current
    if (!start || start.pointerId !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const towardOtherPage = start.primary === 'home' ? dx < 0 : dx > 0
    if (!start.captured && towardOtherPage && Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      start.captured = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (start.captured) event.preventDefault()
  }
  const onPointerUp = (event) => {
    const start = swipe.current
    swipe.current = null
    if (!start || start.pointerId !== event.pointerId || start.primary !== primary) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.4) return
    if ((primary === 'home' && dx < 0) || (primary === 'works' && dx > 0)) {
      swallowClick.current = true
      window.setTimeout(() => { swallowClick.current = false }, 160)
      window.location.hash = primary === 'home' ? '#/works' : '#/'
    }
  }
  const onClickCapture = (event) => {
    if (!swallowClick.current) return
    swallowClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }
  const Page = route === 'works' ? WorksPage : PROTOTYPES[route]
  return (
    <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = null }} onDragStart={(event) => { if (primary && swipe.current) event.preventDefault() }} onClickCapture={onClickCapture}>
      <Suspense fallback={<p className="app-loading">正在载入…</p>}>
        {route ? <Page /> : <HomePage />}
      </Suspense>
      {primary && <PrimaryNav active={primary} />}
    </div>
  )
}
