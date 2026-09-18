import V1BookApp from './v1-book/V1BookApp.jsx'
import CollageMastersPrototype from './v2-collage/prototypes/CollageMastersPrototype.jsx'
import CollageInteractionPrototype from './v2-collage/prototypes/CollageInteractionPrototype.jsx'
import CollageFlowPrototype from './v2-collage/prototypes/CollageFlowPrototype.jsx'
import CarouselMastersPrototype from './v3-carousel/prototypes/CarouselMastersPrototype.jsx'
import CarouselScatterPrototype from './v3-carousel/prototypes/CarouselScatterPrototype.jsx'
import CarouselRhythmPrototype from './v3-carousel/prototypes/CarouselRhythmPrototype.jsx'
import CarouselSmartPrototype from './v3-carousel/prototypes/CarouselSmartPrototype.jsx'
import CarouselScalePrototype from './v3-carousel/prototypes/CarouselScalePrototype.jsx'

// Application seam: this file only selects a version. Each version owns its own implementation.
const PROTOTYPES = {
  'collage-masters': CollageMastersPrototype,
  'collage-interaction': CollageInteractionPrototype,
  'collage-flow': CollageFlowPrototype,
  'carousel-masters': CarouselMastersPrototype,
  'carousel-scatter': CarouselScatterPrototype,
  'carousel-rhythm': CarouselRhythmPrototype,
  'carousel-smart': CarouselSmartPrototype,
  'carousel-scale': CarouselScalePrototype,
}

export default function App() {
  const prototype = new URLSearchParams(window.location.search).get('prototype')
  const Prototype = PROTOTYPES[prototype]
  return Prototype ? <Prototype /> : <V1BookApp />
}
