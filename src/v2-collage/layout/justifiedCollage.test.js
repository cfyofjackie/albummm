import { describe, expect, it } from 'vitest'
import { buildGrowingCollage, buildJustifiedCollage, buildPolaroidStack, buildPolaroidWall, polaroidAspect } from './justifiedCollage.js'

const nanchangPhotos = [
  .75, 1.332, .75, .75, 1.332, 1.332, .75, 1.332, .75, .75,
].map((aspect, index) => ({ id: `nanchang-${index}`, aspect }))

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

describe('横竖图混传的动态母板', () => {
  it('向外生长按真实比例拼出不裁切的照片群', () => {
    const tiles = buildGrowingCollage(nanchangPhotos)
    expect(tiles).toHaveLength(10)
    for (const tile of tiles) {
      expect(tile.width / tile.height).toBeCloseTo(tile.photo.aspect, 6)
      expect(tile.fit).toBe('contain')
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.x + tile.width).toBeLessThanOrEqual(100)
      expect(tile.y + tile.height).toBeLessThanOrEqual(133.3334)
    }
  })

  it('整齐相纸墙让每张相纸随照片窗口改变比例', () => {
    const tiles = buildPolaroidWall(nanchangPhotos.slice(0, 9))
    expect(tiles).toHaveLength(9)
    expect(polaroidAspect(nanchangPhotos[0])).not.toBeCloseTo(polaroidAspect(nanchangPhotos[1]), 4)
    for (const tile of tiles) {
      expect(tile.width / tile.height).toBeCloseTo(polaroidAspect(tile.photo), 6)
      expect(tile.fit).toBe('contain')
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.x + tile.width).toBeLessThanOrEqual(100)
      expect(tile.y + tile.height).toBeLessThanOrEqual(133.3334)
    }
  })

  it('随手叠放的相纸保持自己的比例并留在纸张内', () => {
    const tiles = buildPolaroidStack(nanchangPhotos.slice(0, 6))
    expect(tiles).toHaveLength(6)
    for (const tile of tiles) {
      expect(tile.width / tile.height).toBeCloseTo(polaroidAspect(tile.photo), 6)
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.x + tile.width).toBeLessThanOrEqual(100)
      expect(tile.y + tile.height).toBeLessThanOrEqual(133.3334)
    }
  })
})
