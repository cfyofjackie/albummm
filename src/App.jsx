import { lazy, Suspense, useEffect, useState } from 'react'
import HomePage from './home/HomePage.jsx'

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

const ROUTES = { story: 'carousel-smart', collage: 'v5-reference-layout' }

// hash 一旦出现就以它为准（首页链接写成 #/，这样才能从带 ?prototype= 的页面回到首页）；
// 没有 hash 时才回退读取旧参数。
function currentRoute() {
  const { hash, search } = window.location
  if (hash && hash !== '#') {
    const path = hash.replace(/^#\/?/, '').replace(/\/$/, '')
    return ROUTES[path] ?? null
  }
  const prototype = new URLSearchParams(search).get('prototype')
  return prototype && prototype in PROTOTYPES ? prototype : null
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  useEffect(() => {
    const sync = () => setRoute(currentRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  if (!route) return <HomePage />
  const Page = PROTOTYPES[route]
  return (
    <Suspense fallback={<p className="app-loading">正在载入…</p>}>
      <Page />
    </Suspense>
  )
}
