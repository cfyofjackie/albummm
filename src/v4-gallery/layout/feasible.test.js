import { describe, it } from 'vitest'
import { getTemplate } from './overviewLayout.js'
import { boardFor, zoneOf } from './skeleton.js'
import * as collagePile from './capabilities/collagePile.js'

const SETS = {
  '全竖图13': [0.67, 0.67, 0.7, 0.75, 0.67, 0.7, 0.75, 0.67, 0.7, 0.75, 0.67, 0.7, 0.75],
  '全横图13': [1.5, 1.5, 1.4, 1.33, 1.5, 1.4, 1.33, 1.5, 1.4, 1.33, 1.5, 1.4, 1.33],
  '混传13': [4 / 3, 3 / 4, 3 / 2, 2 / 3, 1, 4 / 3, 3 / 4, 1, 3 / 2, 2 / 3, 4 / 3, 1, 3 / 4],
  '参考13': [1.33, 1.5, 0.75, 0.67, 1.33, 1.5, 1.33, 0.75, 1.5, 1.33, 0.75, 1.33, 1.5],
}

describe('feasible', () => {
  it.each(Object.entries(SETS))('%s', (name, aspects) => {
    const skeleton = getTemplate('full-bleed-collage')
    const board = boardFor(skeleton)
    const entries = aspects.map((aspect, index) => ({ photo: { id: `p${index}`, aspect }, index, placed: aspect, original: aspect, clamped: false }))
    const blocks = collagePile.blocks(entries, skeleton, { seed: 'gallery-01', zones: zoneOf(skeleton), board })
    const target = { board, minCoverage: 0.6, maxCoverage: 0.75, minPhotoShare: 0.2, preferredOverlap: 0.25 }
    const rows = blocks.map((b) => ({ b, s: collagePile.score(b, target) }))
    const wide = rows.filter((r) => r.s.narrowest >= 0.2)
    const good = wide.filter((r) => r.s.coverage >= 0.6)
    console.log(name, 'total', rows.length, 'wide', wide.length, 'wide+covered', good.length,
      'bestWide', wide.length ? JSON.stringify({ rows: wide[0].b.rows, sizes: wide[0].b.rowSizes.join('/'), sp: wide[0].b.spacing.toFixed(2), fill: wide[0].b.fill.toFixed(2), narrow: wide[0].s.narrowest.toFixed(3), cov: wide[0].s.coverage.toFixed(3) }) : 'none',
      'maxNarrow', Math.max(...rows.map((r) => r.s.narrowest)).toFixed(3),
      'bestCov', Math.max(...rows.map((r) => r.s.coverage)).toFixed(3))
    if (good.length) {
      console.log('  sample', good.slice(0, 3).map((r) => `rows=${r.b.rows} ${r.b.rowSizes.join('/')} sp=${r.b.spacing.toFixed(2)} fill=${r.b.fill.toFixed(2)} narrow=${r.s.narrowest.toFixed(3)} cov=${r.s.coverage.toFixed(3)} spill=${r.s.reach.toFixed(2)}`).join(' | '))
    }
    const sorted = [...rows].sort((a, b) => a.s.total - b.s.total)
    console.log('  winner', JSON.stringify({ rows: sorted[0].b.rows, sizes: sorted[0].b.rowSizes.join('/'), sp: sorted[0].b.spacing.toFixed(2), fill: sorted[0].b.fill.toFixed(2), cov: +sorted[0].s.coverage.toFixed(3), narrow: +sorted[0].s.narrowest.toFixed(3), reach: +sorted[0].s.reach.toFixed(3), ratioMiss: +sorted[0].s.ratioMiss.toFixed(3), total: +sorted[0].s.total.toFixed(1) }))
    const wideBest = [...wide].sort((a, b) => a.s.total - b.s.total)[0]
    console.log('  bestWide', JSON.stringify({ rows: wideBest.b.rows, sizes: wideBest.b.rowSizes.join('/'), sp: wideBest.b.spacing.toFixed(2), fill: wideBest.b.fill.toFixed(2), cov: +wideBest.s.coverage.toFixed(3), narrow: +wideBest.s.narrowest.toFixed(3), reach: +wideBest.s.reach.toFixed(3), ratioMiss: +wideBest.s.ratioMiss.toFixed(3), total: +wideBest.s.total.toFixed(1) }))
  })
})
