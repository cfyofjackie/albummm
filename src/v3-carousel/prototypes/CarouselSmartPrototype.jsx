import CarouselScatterPrototype from './CarouselScatterPrototype.jsx'

// PROTOTYPE — Three style-specific second-tier decorations are switchable via
// ?prototype=carousel-smart&decor=tier2&variant=gallery|muse|weekend.
export default function CarouselSmartPrototype() {
  const params = new URLSearchParams(window.location.search)
  return <CarouselScatterPrototype smart decorExperiment={params.get('decor') === 'tier2'} />
}
