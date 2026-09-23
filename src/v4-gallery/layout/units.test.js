import { describe, it } from 'vitest'
import { getTemplate, buildGalleryOverview } from './overviewLayout.js'
import { boardFor, zoneOf } from './skeleton.js'
import { frameBox } from './contract.js'
import * as collagePile from './capabilities/collagePile.js'

describe('units', () => {
  it('one frame', () => {
    const skeleton = getTemplate('full-bleed-collage')
    const board = boardFor(skeleton)
    const aspects = [1.33, 1.5, 0.75, 0.67, 1.33, 1.5, 1.33, 0.75, 1.5, 1.33, 0.75, 1.33, 1.5]
    const entries = aspects.map((aspect, index) => ({ photo: { id: `p${index}`, aspect }, index, placed: aspect, original: aspect, clamped: false }))
    const blocks = collagePile.blocks(entries, skeleton, { seed: 'gallery-01', zones: zoneOf(skeleton), board })
    const target = { board, minCoverage: 0.6, maxCoverage: 0.9, minPhotoShare: 0.2, preferredOverlap: 0.25 }
    const best = blocks.map((b) => ({ b, s: collagePile.score(b, target) })).sort((x, y) => x.s.total - y.s.total)[0].b
    const f0 = best.frames[0]
    console.log('frame', JSON.stringify({ w: +f0.width.toFixed(3), h: +f0.height.toFixed(3), cx: +f0.centreX.toFixed(3), cy: +f0.centreY.toFixed(3), tilt: +f0.tilt.toFixed(3), ratio: +f0.ratio.toFixed(3) }))
    console.log('fit', JSON.stringify({ scale: +best.fit.scale.toFixed(4), ox: +best.fit.offsetX.toFixed(3), oy: +best.fit.offsetY.toFixed(3) }))
    console.log('extent', JSON.stringify({ l: +best.fit.extent.left.toFixed(2), r: +best.fit.extent.right.toFixed(2), t: +best.fit.extent.top.toFixed(2), b: +best.fit.extent.bottom.toFixed(2) }))
    console.log('tile0', JSON.stringify(best.fit.tiles[0]))
    const layout = buildGalleryOverview(aspects.map((aspect, index) => ({ id: `p${index}`, aspect })), 'gallery-01', 'full-bleed-collage')
    const l0 = layout[0]
    console.log('layout0', JSON.stringify({ card: l0.card, cx: +l0.centreX.toFixed(3), cy: +l0.centreY.toFixed(3), tilt: +l0.tilt.toFixed(3) }))
    const box = frameBox(l0, board)
    const rad = (Math.abs(l0.tilt) * Math.PI) / 180
    const rw = l0.card.width * Math.cos(rad) + l0.card.height * Math.sin(rad)
    const rh = l0.card.width * Math.sin(rad) + l0.card.height * Math.cos(rad)
    console.log('rot extents', JSON.stringify({ rw: +rw.toFixed(3), rh: +rh.toFixed(3), rwPhysical: +(rw * board.yFactor).toFixed(3), rhPhysical: +(rh * board.yFactor).toFixed(3) }))
    console.log('frameBox0', JSON.stringify({ x: +box.x.toFixed(3), y: +box.y.toFixed(3), w: +box.width.toFixed(3), h: +box.height.toFixed(3) }))
  })
})
