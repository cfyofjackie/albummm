import { describe, expect, it } from 'vitest'
import { BOARD_HEIGHT, BOARD_WIDTH, aspectOf, buildGalleryOverview, overlaps } from './overviewLayout.js'

const makePhotos = (aspects) => aspects.map((aspect, index) => ({ id: `photo-${index}`, aspect }))

describe('V4 Gallery overview 母板', () => {
  it.each([
    ['全竖图', [.67, .67, .75, .7, .67, .75, .7, .67]],
    ['全横图', [1.5, 1.33, 1.6, 1.4, 1.5, 1.33, 1.6, 1.4]],
    ['横竖混传', [.75, 1.33, .67, 1.6, .8, 1.4, .7, 1.5, .75, 1.33]],
  ])('%s 不压扁并落在 4:5 画布内', (_, aspects) => {
    const layout = buildGalleryOverview(makePhotos(aspects), 'nanchang-road')
    expect(layout).toHaveLength(aspects.length)
    for (const tile of layout) {
      expect(tile.width / tile.height).toBeCloseTo(aspectOf(tile.photo), 8)
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.x + tile.width).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(tile.y + tile.height).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  it('相同 seed 稳定，而新的 seed 只在母板范围内改变位置', () => {
    const photos = makePhotos([.75, 1.33, .7, 1.5, .8, 1.4, .7, 1.5])
    expect(buildGalleryOverview(photos, 'same')).toEqual(buildGalleryOverview(photos, 'same'))
    expect(buildGalleryOverview(photos, 'same')).not.toEqual(buildGalleryOverview(photos, 'next'))
  })

  it('主图拥有最大面积，辅助图与细节图维持层级', () => {
    const layout = buildGalleryOverview(makePhotos([.75, 1.33, .7, 1.5, .8, 1.4]), 'roles')
    const area = (tile) => tile.width * tile.height
    expect(area(layout[0])).toBeGreaterThan(area(layout[1]))
    expect(area(layout[0])).toBeGreaterThan(area(layout[2]))
    expect(layout.filter((tile) => tile.role === 'detail').some((tile) => overlaps(tile, layout[0]))).toBe(false)
  })
})
