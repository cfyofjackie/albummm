// Capability registry.
//
// The point of this layer is that adding a layout family must not mean adding an
// algorithm. A template picks capability names; the solver knows how to drive
// them. The discipline that keeps this honest: a capability must be reusable by
// at least two templates, otherwise it is private logic and does not belong here.

import * as collagePile from './collagePile.js'
import * as justifiedRows from './justifiedRows.js'
import * as spanGrid from './spanGrid.js'

const REGISTRY = {
  'span-grid': spanGrid,
  'justified-rows': justifiedRows,
  // Uniform polaroid frames dropped into overlapping, tilted rows that fill the
  // whole sheet. It reads "collage" rather than "pile" because the interesting
  // part is the composing — how many per row, how much they stack — not the mess.
  'collage-pile': collagePile,
}

export function capability(name) {
  const found = REGISTRY[name]
  if (!found) {
    throw new Error(`未知能力 "${name}"。已注册：${Object.keys(REGISTRY).join(', ')}`)
  }
  return found
}

export function registeredCapabilities() {
  return Object.keys(REGISTRY)
}
