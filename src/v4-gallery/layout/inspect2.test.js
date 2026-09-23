import { describe, it } from 'vitest'
import { getTemplate, verifyContract, buildGalleryOverview } from './overviewLayout.js'
import { boardFor, zoneOf } from './skeleton.js'
import { frameBox, boundingBoxOf } from './contract.js'
import * as collagePile from './capabilities/collagePile.js'

describe('fit inspect', () => {
  it('ref13', () => {
    const skeleton = getTemplate('full-bleed-collage')
    const board = boardFor(skeleton)
    const aspects = [1.33, 1.5, 0.75, 0.67, 1.33, 1.5, 1.33, 0.75, 1.5, 1.33, 0.75, 1.33, 1.5]
    const entries = aspects.map((aspect, index) => ({ photo: { id: `p${index}`, aspect }, index, placed: aspect, original: aspect, clamped: false }))
    const blocks = collagePile.blocks(entries, skeleton, { seed: 'gallery-01', zones: zoneOf(skeleton), board })
    const target = { board, minCoverage: 0.6, maxCoverage: 0.9, minPhotoShare: 0.2, preferredOverlap: 0.25 }
    const best = blocks.map((b) => ({ b, s: collagePile.score(b, target) })).sort((x, y) => x.s.total - y.s.total)[0].b
    const tiles = best.fit.tiles
    const boxes = tiles.map((t) => frameBox(t, board))
    const bb = tiles.map((t) => boundingBoxOf(t, board))
    const extent = (list) => JSON.stringify({
      l: Math.min(...list.map((b) => b.x)).toFixed(1),
      r: Math.max(...list.map((b) => b.x + b.width)).toFixed(1),
      t: Math.min(...list.map((b) => b.y)).toFixed(1),
      b: Math.max(...list.map((b) => b.y + b.height)).toFixed(1),
    })
    console.log('scale', best.fit.scale.toFixed(3))
    console.log('frameBox extent', extent(boxes))
    console.log('boundingBox extent', extent(bb))
    const layout = buildGalleryOverview(aspects.map((aspect, index) => ({ id: `p${index}`, aspect })), 'gallery-01', 'full-bleed-collage')
    const lb = layout.map((t) => frameBox(t, board))
    console.log('layout frameBox extent', extent(lb))
    const manual = layout.map((t) => {
      const tilt = (Math.abs(t.tilt) * Math.PI) / 180
      const w = t.card.width * Math.cos(tilt) + t.card.height * Math.sin(tilt)
      const h = t.card.width * Math.sin(tilt) + t.card.height * Math.cos(tilt)
      return {
        x: t.centreX - w / 2,
        y: (t.centreY - (h * board.yFactor) / 2) / board.yFactor,
        width: w,
        height: h,
      }
    })
    console.log('manual extent', extent(manual))
    console.log('frameBox[0]', JSON.stringify(frameBox(layout[0], board)))
    console.log('manual[0]', JSON.stringify(manual[0]))
    console.log('metrics', JSON.stringify(verifyContract(layout, skeleton).metrics))
    console.log('trace', JSON.stringify(globalThis.__FIT_TRACE.slice(-3)))
  })
})
