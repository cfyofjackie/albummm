import { describe, it } from 'vitest'
import { buildGalleryOverview, getTemplate, verifyContract } from './overviewLayout.js'

const SETS = {
  '全竖图13': [0.67, 0.67, 0.7, 0.75, 0.67, 0.7, 0.75, 0.67, 0.7, 0.75, 0.67, 0.7, 0.75],
  '全横图13': [1.5, 1.5, 1.4, 1.33, 1.5, 1.4, 1.33, 1.5, 1.4, 1.33, 1.5, 1.4, 1.33],
  '混传13': [4 / 3, 3 / 4, 3 / 2, 2 / 3, 1, 4 / 3, 3 / 4, 1, 3 / 2, 2 / 3, 4 / 3, 1, 3 / 4],
  '方图12': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  '参考13': [1.33, 1.5, 0.75, 0.67, 1.33, 1.5, 1.33, 0.75, 1.5, 1.33, 0.75, 1.33, 1.5],
  '少6': [1.5, 0.75, 1.33, 0.67, 1, 1.4],
  '满10': [4 / 3, 3 / 4, 3 / 2, 2 / 3, 1, 4 / 3, 3 / 4, 1, 3 / 2, 2 / 3],
}

describe('survey', () => {
  it.each(Object.entries(SETS))('%s', (name, aspects) => {
    const skeleton = getTemplate('full-bleed-collage')
    for (const seed of ['gallery-01', 'gallery-02', 'gallery-03']) {
      const photos = aspects.map((aspect, index) => ({ id: `p${index}`, aspect }))
      const layout = buildGalleryOverview(photos, seed, 'full-bleed-collage')
      const r = verifyContract(layout, skeleton)
      const m = r.metrics
      if (name === '参考13' && seed === 'gallery-01') {
        console.log('   fit', JSON.stringify(globalThis.__FIT_LAST))
      }
      console.log(name.padEnd(9), seed.slice(-2), 'ink', m.ink.toFixed(3), 'wSpan', m.blockWidthShare.toFixed(2),
        'hSpan', m.blockHeightShare.toFixed(2), 'medW', m.medianTileShare.toFixed(3), 'minW', m.narrowestTileShare.toFixed(3),
        'v', r.violations.length, 'n', r.notes.length)
    }
  })
})
