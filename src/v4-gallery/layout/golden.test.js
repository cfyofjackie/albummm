// Golden test: the layout must not drift for a reason nobody intended.
//
// check/_v4/golden/todayMoment.json is a frozen snapshot of the solver's output for
// every input family and seed. It began as the migration baseline — proving that
// replacing the hand-tuned solver with skeletons plus capabilities changed nothing
// — and it stays useful as a drift alarm: any layout change shows up here as an
// exact per-coordinate diff, a far better signal than eyeballing a screenshot.
//
// It has been regenerated twice, deliberately, while narrowing the accepted
// proportion band to its final 2:3..3:2 — first from 9:16..16:9, then from that
// down to the band in use now as 16:9 and 9:16 were dropped. Both times the diff
// touched exactly the input families containing out-of-band ratios and nothing
// else, which is the property that makes this fixture worth keeping.
//
// Regenerate only when a layout change is intended, and read the diff first:
//   node check/_v4/golden.mjs
import { describe, expect, it } from 'vitest'
import fixture from '../../../check/_v4/golden/todayMoment.json'
import { buildGalleryOverview, solveTemplateWith, validateAllTemplates } from './overviewLayout.js'
import { getTemplate } from '../templates/index.js'

const round = (value) => Number(value.toFixed(fixture.decimals))

describe('V4 骨架迁移：输出与模板化之前逐位一致', () => {
  it('所有模板骨架都通过 schema 校验', () => {
    expect(validateAllTemplates()).toEqual([])
  })

  it('金标准夹具覆盖了全部输入与 seed', () => {
    expect(Object.keys(fixture.results)).toHaveLength(Object.keys(fixture.inputs).length * fixture.seeds.length)
  })

  it.each(Object.keys(fixture.results))('%s', (key) => {
    const [inputName, seed] = key.split('|')
    const aspects = fixture.inputs[inputName]
    const photos = aspects.map((aspect, index) => ({ id: `${inputName}-p${index}`, aspect }))
    const layout = buildGalleryOverview(photos, seed)

    // Two layers of assertion: the shape of the result, then every number.
    expect(layout.map((tile) => tile.id)).toEqual(fixture.results[key].map((tile) => tile.id))
    expect(layout.map((tile) => ({
      id: tile.id,
      x: round(tile.x),
      y: round(tile.y),
      width: round(tile.width),
      height: round(tile.height),
      zIndex: tile.zIndex,
      cols: tile.cols,
      crop: Boolean(tile.crop),
    }))).toEqual(fixture.results[key])
  })

  it('同一份骨架直接求解，与按 id 求解结果一致', () => {
    const aspects = fixture.inputs['mixed-8']
    const photos = aspects.map((aspect, index) => ({ id: `mixed-8-p${index}`, aspect }))
    const viaRegistry = buildGalleryOverview(photos, 'gallery-01')
    const viaSkeleton = solveTemplateWith(getTemplate('today-moment'), photos, 'gallery-01')
    expect(viaSkeleton).toEqual(viaRegistry)
  })
})
