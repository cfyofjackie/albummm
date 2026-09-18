import { describe, expect, it } from 'vitest'
import { BOARD_HEIGHT, BOARD_WIDTH, aspectOf, buildGalleryOverview, focusCameraFor, overlaps } from './overviewLayout.js'

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
      // The board is 4:5, so the raw layout height is not a physical height.
      // Validate the ratio users actually see after the board is rendered.
      expect(tile.width / (tile.height * (BOARD_WIDTH / BOARD_HEIGHT))).toBeCloseTo(aspectOf(tile.photo), 8)
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

  it('照片从主图向外长成一个相连且不重叠的整体', () => {
    const layout = buildGalleryOverview(makePhotos([.75, 1.33, .7, 1.5, .8, 1.4, .7, 1.5]), 'growth-check')

    layout.forEach((tile, index) => {
      layout.slice(index + 1).forEach((other) => {
        expect(overlaps(tile, other)).toBe(false)
      })
    })

    const connected = new Set([layout[0].id])
    while (connected.size < layout.length) {
      const next = layout.find((tile) => {
        if (connected.has(tile.id)) return false
        return layout.some((anchor) => {
          if (!connected.has(anchor.id)) return false
          const xGap = Math.max(anchor.x - (tile.x + tile.width), tile.x - (anchor.x + anchor.width), 0)
          const yGap = Math.max(anchor.y - (tile.y + tile.height), tile.y - (anchor.y + anchor.height), 0)
          return xGap <= 3 && yGap <= 3
        })
      })
      if (!next) break
      connected.add(next.id)
    }

    expect(connected.size).toBe(layout.length)
  })

  it('原位聚焦只移动视口，让目标照片的中心进入画布中心', () => {
    const [main, , , detail] = buildGalleryOverview(makePhotos([.75, 1.33, .7, 1.5]), 'focus-camera')
    for (const tile of [main, detail]) {
      const camera = focusCameraFor(tile)
      const centeredX = (tile.x + tile.width / 2) * camera.scale + camera.translateX
      const centeredY = (tile.y + tile.height / 2) * camera.scale + camera.translateY / 100 * BOARD_HEIGHT
      expect(centeredX).toBeCloseTo(50, 8)
      expect(centeredY).toBeCloseTo(BOARD_HEIGHT / 2, 8)
      expect(camera.scale).toBeGreaterThanOrEqual(1.35)
      expect(camera.scale).toBeLessThanOrEqual(2.6)
    }
  })
})
