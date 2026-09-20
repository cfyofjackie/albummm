import CarouselScatterPrototype from './CarouselScatterPrototype.jsx'

// PROTOTYPE — 两个独立的 V3 视觉实验都挂在稳定的 smart 版上：
// `decor=tier2` 试风格专属装饰；`backgrounds=masters` 试三套背景结构。
// 两者都不改智能分页、尺寸边界或材质轴。
export default function CarouselSmartPrototype() {
  const params = new URLSearchParams(window.location.search)
  return (
    <CarouselScatterPrototype
      smart
      decorExperiment={params.get('decor') === 'tier2'}
      backgroundExperiment={params.get('backgrounds') === 'masters'}
    />
  )
}
