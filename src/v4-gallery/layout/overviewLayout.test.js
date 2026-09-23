import { describe, expect, it } from 'vitest'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  MAX_RATIO,
  MIN_RATIO,
  aspectOf,
  buildGalleryOverview,
  describeSuggestion,
  focusCameraFor,
  getTemplate,
  overlaps,
  registeredCapabilities,
  validateAllTemplates,
  verifyContract,
} from './overviewLayout.js'

const FRAME_ASPECT = BOARD_WIDTH / BOARD_HEIGHT
const makePhotos = (aspects) => aspects.map((aspect, index) => ({ id: `photo-${index}`, aspect }))

// Width is percent of board width and height is percent of board height. Because
// the board is taller than it is wide, converting the height into width units
// *multiplies* by FRAME_ASPECT (0.8) — 100% of board height is 125 units of board
// width. This is the one conversion every ratio assertion needs.
const renderedRatio = (tile) => tile.width / (tile.height * FRAME_ASPECT)

describe('V4 Gallery overview 母板', () => {
  it.each([
    ['全竖图', [.67, .67, .75, .7, .67, .75, .7, .67]],
    ['全横图', [1.5, 1.33, 1.45, 1.4, 1.5, 1.33, 1.45, 1.4]],
    ['横竖混传', [.75, 1.33, .67, 1.45, .8, 1.4, .7, 1.5, .75, 1.33]],
    ['参考图风格', [.67, .75, .7, .67, 1.5, 1.4, 1.33, 1.5, 1.45, 1.4]],
    ['方图为主', [1, 1, 1.2, .9, 1, 1.1]],
  ])('%s 不压扁、不裁切并落在 4:5 画布内', (_, aspects) => {
    const layout = buildGalleryOverview(makePhotos(aspects), 'nanchang-road')
    expect(layout).toHaveLength(aspects.length)
    for (const tile of layout) {
      expect(renderedRatio(tile)).toBeCloseTo(aspectOf(tile.photo), 6)
      expect(tile.x).toBeGreaterThanOrEqual(-0.001)
      expect(tile.y).toBeGreaterThanOrEqual(-0.001)
      expect(tile.x + tile.width).toBeLessThanOrEqual(BOARD_WIDTH + 0.001)
      expect(tile.y + tile.height).toBeLessThanOrEqual(BOARD_HEIGHT + 0.001)
    }
  })

  it.each([
    ['全竖图', [.67, .67, .75, .7, .67, .75, .7, .67]],
    ['全横图', [1.5, 1.33, 1.45, 1.4, 1.5, 1.33, 1.45, 1.4]],
    ['横竖混传', [.75, 1.33, .67, 1.45, .8, 1.4, .7, 1.5]],
    ['参考图风格', [.67, .75, .7, .67, 1.5, 1.4, 1.33, 1.5, 1.45, 1.4]],
    ['方图为主', [1, 1, 1.2, .9, 1, 1.1]],
    ['少量 5 张', [1.5, .67, 1.4, .75, 1.33]],
  ])('%s 得到一个相连的照片块，而不是一列或一条', (_, aspects) => {
    const layout = buildGalleryOverview(makePhotos(aspects), 'shape-check')
    const minX = Math.min(...layout.map((tile) => tile.x))
    const maxX = Math.max(...layout.map((tile) => tile.x + tile.width))
    const minY = Math.min(...layout.map((tile) => tile.y))
    const maxY = Math.max(...layout.map((tile) => tile.y + tile.height))

    // More than one column and more than one row: a single stripe is the failure
    // mode this whole solver exists to prevent.
    const columns = new Set(layout.map((tile) => Math.round(tile.x * 10)))
    expect(columns.size).toBeGreaterThan(1)
    expect(maxY - minY).toBeGreaterThan(10)

    // Nothing is orphaned outside the block.
    for (const tile of layout) {
      expect(tile.x).toBeGreaterThanOrEqual(minX - 0.001)
      expect(tile.y).toBeGreaterThanOrEqual(minY - 0.001)
    }

    // And the block satisfies the shared invariants plus the template's own
    // declared ranges. This replaces a hand-picked width threshold, which went
    // stale every time the composition was tuned.
    const report = verifyContract(layout, getTemplate('today-moment'))
    expect(report.violations).toEqual([])
  })

  it.each([
    ['全竖图', [.67, .67, .75, .7, .67, .75, .7, .67]],
    ['全横图', [1.5, 1.33, 1.45, 1.4, 1.5, 1.33, 1.45, 1.4]],
    ['横竖混传', [.75, 1.33, .67, 1.45, .8, 1.4, .7, 1.5]],
  ])('%s 照片之间不重叠', (_, aspects) => {
    const layout = buildGalleryOverview(makePhotos(aspects), 'overlap-check')
    layout.forEach((tile, index) => {
      layout.slice(index + 1).forEach((other) => {
        expect(overlaps(tile, other)).toBe(false)
      })
    })
  })

  it('相同 seed 稳定，而新的 seed 只在同一结构内换位置', () => {
    const photos = makePhotos([.75, 1.33, .7, 1.5, .8, 1.4, .7, 1.5])
    expect(buildGalleryOverview(photos, 'same')).toEqual(buildGalleryOverview(photos, 'same'))
    expect(buildGalleryOverview(photos, 'same')).not.toEqual(buildGalleryOverview(photos, 'next'))

    // A new seed rearranges but must not change the family of the result: the
    // column count and the size of the largest tile stay in the same band.
    const a = buildGalleryOverview(photos, 'same')
    const b = buildGalleryOverview(photos, 'next')
    expect(a[0].cols).toBe(b[0].cols)
    const largest = (layout) => Math.max(...layout.map((tile) => tile.width * tile.height))
    expect(largest(a) / largest(b)).toBeGreaterThan(0.5)
    expect(largest(a) / largest(b)).toBeLessThan(2)
  })

  it('主次由求解结果决定：最大的一张显著大于最小的一张，但不吞掉整块', () => {
    const layout = buildGalleryOverview(makePhotos([.75, 1.33, .7, 1.5, .8, 1.4, .7, 1.5]), 'roles')
    const area = (tile) => tile.width * tile.height
    const areas = layout.map(area).sort((a, b) => b - a)
    const total = areas.reduce((sum, value) => sum + value, 0)
    expect(areas[0]).toBeGreaterThan(areas[areas.length - 1])
    expect(areas[0] / total).toBeLessThanOrEqual(0.5)
    // And the order in the returned array is z-order, not importance.
    expect(layout[0].zIndex).toBe(1)
    expect(layout[layout.length - 1].zIndex).toBe(layout.length)
  })

  it('超出允收比例的照片被折回边界，并标注为需要裁切', () => {
    const layout = buildGalleryOverview(makePhotos([.4, 2.67, 1.5, .67]), 'extreme')
    expect(layout).toHaveLength(4)
    // 0.4 and 2.67 are outside 2:3..3:2; 1.5 and 0.67 sit exactly on the boundary.
    const clamped = layout.filter((tile) => tile.crop)
    expect(clamped).toHaveLength(2)
    for (const tile of layout) {
      // The photo keeps its real ratio; what the layout commits to is the folded
      // one, and that is what the rendered ratio has to agree with.
      const committed = Math.max(MIN_RATIO, Math.min(MAX_RATIO, aspectOf(tile.photo)))
      expect(renderedRatio(tile)).toBeCloseTo(committed, 6)
      expect(committed).toBeGreaterThanOrEqual(MIN_RATIO - 1e-9)
      expect(committed).toBeLessThanOrEqual(MAX_RATIO + 1e-9)
    }
  })

  it('原位聚焦只移动视口，让目标照片的中心进入画布中心', () => {
    const [main, , , detail] = buildGalleryOverview(makePhotos([.75, 1.33, .7, 1.5]), 'focus-camera')
    for (const tile of [main, detail]) {
      const camera = focusCameraFor(tile)
      const centeredX = (tile.x + tile.width / 2) * camera.scale + camera.translateX
      const centeredY = (tile.y + tile.height / 2) * camera.scale + camera.translateY
      expect(centeredX).toBeCloseTo(50, 6)
      expect(centeredY).toBeCloseTo(50, 6)
      expect(camera.scale).toBeGreaterThanOrEqual(1.35)
      expect(camera.scale).toBeLessThanOrEqual(2.6)
    }
  })
})
