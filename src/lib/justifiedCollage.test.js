import { describe, expect, it } from 'vitest'
import { buildJustifiedCollage } from './justifiedCollage.js'

describe('不裁切的整齐拼图', () => {
  it('保留每张横图、竖图的原始比例', () => {
    const photos = [
      { id: 'main', aspect: 3 / 4 },
      { id: 'landscape', aspect: 4 / 3 },
      { id: 'portrait', aspect: 2 / 3 },
      { id: 'wide', aspect: 3 / 2 },
      { id: 'portrait-2', aspect: 3 / 4 },
      { id: 'landscape-2', aspect: 4 / 3 },
      { id: 'portrait-3', aspect: 2 / 3 },
    ]
    const tiles = buildJustifiedCollage(photos)

    expect(tiles).toHaveLength(photos.length)
    expect(tiles[0].photo.id).toBe('main')
    for (const tile of tiles) {
      expect(tile.width / tile.height).toBeCloseTo(tile.photo.aspect, 6)
      expect(tile.fit).toBe('contain')
    }
  })

  it('所有照片都落在纸张安全区域内，彼此不重叠', () => {
    const photos = Array.from({ length: 7 }, (_, index) => ({ id: String(index), aspect: index % 2 ? 4 / 3 : 3 / 4 }))
    const tiles = buildJustifiedCollage(photos)

    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.x + tile.width).toBeLessThanOrEqual(100)
      expect(tile.y + tile.height).toBeLessThanOrEqual(133.3334)
    }
    for (let index = 0; index < tiles.length; index++) {
      for (let compare = index + 1; compare < tiles.length; compare++) {
        const a = tiles[index]
        const b = tiles[compare]
        const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        expect(overlaps).toBe(false)
      }
    }
  })
})
