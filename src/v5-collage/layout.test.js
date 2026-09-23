import { describe, expect, it } from 'vitest'
import { BOARD_RATIO, FRAME_MODES, REQUIRED_PHOTO_COUNT, acceptedFormatFor, buildReferenceLayout, partitionUploads, selectLayoutProfile } from './layout.js'
import { buildAutoDecorationPlacements, rectanglesOverlap, rotatedBounds } from './decorations.js'

const photos = Array.from({ length: REQUIRED_PHOTO_COUNT }, (_, index) => ({
  id: `photo-${index}`,
  width: [4, 3, 1, 3, 2][index % 5] * 300,
  height: [3, 4, 1, 2, 3][index % 5] * 300,
}))

describe('V5 reference collage layout', () => {
  it('keeps all ten original photo proportions and gives them equal visual area', () => {
    const layout = buildReferenceLayout(photos)
    expect(layout).toHaveLength(10)
    layout.forEach((tile) => {
      expect(tile.content.width * BOARD_RATIO / tile.content.height).toBeCloseTo(tile.photo.width / tile.photo.height)
      expect(tile.content.width * tile.content.height / BOARD_RATIO).toBeCloseTo(520)
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.x + tile.width).toBeLessThanOrEqual(100)
      expect(tile.y + tile.height).toBeLessThanOrEqual(100)
    })
  })

  it('recalculates a safe outer card layout for polaroid frames', () => {
    const layout = buildReferenceLayout(photos, FRAME_MODES.polaroid.id)
    layout.forEach((tile, index) => {
      expect(tile.width).toBeGreaterThan(tile.content.width)
      expect(tile.height).toBeGreaterThan(tile.content.height)
      expect(tile.content.width * BOARD_RATIO / tile.content.height).toBeCloseTo(tile.photo.width / tile.photo.height)
      expect(tile.content.width * tile.content.height / BOARD_RATIO).toBeCloseTo(layout[0].content.width * layout[0].content.height / BOARD_RATIO)
      layout.slice(index + 1).forEach((other) => {
        const width = Math.max(0, Math.min(tile.content.x + tile.content.width, other.content.x + other.content.width) - Math.max(tile.content.x, other.content.x))
        const height = Math.max(0, Math.min(tile.content.y + tile.content.height, other.content.y + other.content.height) - Math.max(tile.content.y, other.content.y))
        expect(width * height / Math.min(tile.content.width * tile.content.height, other.content.width * other.content.height)).toBeLessThanOrEqual(.08)
      })
    })
  })

  it('allows only the five V5 input formats, with small camera rounding tolerance', () => {
    expect(acceptedFormatFor({ width: 4032, height: 3024 })?.label).toBe('4:3')
    expect(acceptedFormatFor({ width: 1080, height: 1920 })).toBeNull()
    expect(acceptedFormatFor({ width: 1920, height: 1080 })).toBeNull()
  })

  it('fills the two largest safe gaps with stable decorations without touching photos', () => {
    const layout = buildReferenceLayout(photos, FRAME_MODES.polaroid.id)
    const firstRun = buildAutoDecorationPlacements(layout)
    const secondRun = buildAutoDecorationPlacements(layout)
    expect(firstRun).toHaveLength(2)
    expect(secondRun).toEqual(firstRun)
    firstRun.forEach((decoration) => {
      expect(decoration.safetyBounds.x).toBeGreaterThanOrEqual(2.5)
      expect(decoration.safetyBounds.y).toBeGreaterThanOrEqual(2.5)
      layout.forEach((tile) => {
        expect(rectanglesOverlap(decoration.safetyBounds, rotatedBounds(tile), 1.2)).toBe(false)
      })
    })
  })

  it('switches to a dense portrait skeleton rather than forcing portrait photos into the mixed template', () => {
    const portraitPhotos = Array.from({ length: REQUIRED_PHOTO_COUNT }, (_, index) => ({
      id: `portrait-${index}`,
      width: 900,
      height: 1200,
    }))
    const portraitLayout = buildReferenceLayout(portraitPhotos, FRAME_MODES.polaroid.id)
    expect(selectLayoutProfile(portraitPhotos)).toBe('portrait')
    expect(portraitLayout).toHaveLength(REQUIRED_PHOTO_COUNT)
    expect(portraitLayout.every((tile) => tile.profile === 'portrait')).toBe(true)
    // 三行紧凑簇的中心分布，替代旧模板的上下散点与大中心留白。
    const rowCounts = [30, 65, 100].map((upperBound, index) => portraitLayout.filter((tile) => {
      const centerY = tile.y + tile.height / 2
      const lowerBound = index === 0 ? 0 : [30, 65, 100][index - 1]
      return centerY >= lowerBound && centerY < upperBound
    }).length)
    expect(rowCounts).toEqual([3, 4, 3])
    portraitLayout.forEach((tile) => {
      expect(tile.content.width * BOARD_RATIO / tile.content.height).toBeCloseTo(.75)
    })
  })

  it('detects landscape-heavy, square-heavy and mixed upload sets', () => {
    const landscapePhotos = Array.from({ length: REQUIRED_PHOTO_COUNT }, (_, index) => ({ id: `land-${index}`, width: 4, height: 3 }))
    const squarePhotos = Array.from({ length: REQUIRED_PHOTO_COUNT }, (_, index) => ({ id: `square-${index}`, width: 1, height: 1 }))
    expect(selectLayoutProfile(landscapePhotos)).toBe('landscape')
    expect(selectLayoutProfile(squarePhotos)).toBe('square')
    expect(selectLayoutProfile(photos)).toBe('mixed')
  })
})

describe('upload partitioning（超过 10 张时保留前 10 张合规照片）', () => {
  const V = 'valid'
  const R = 'ratio'
  const T = 'type'

  it('adopts exactly ten valid photos', () => {
    const summary = partitionUploads(Array.from({ length: 10 }, () => V))
    expect(summary.adoptedIndexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(summary.unusedValid).toBe(0)
    expect(summary.ratioRejected).toBe(0)
    expect(summary.typeRejected).toBe(0)
  })

  it('keeps the first ten in selection order and reports the rest as unused', () => {
    const summary = partitionUploads(Array.from({ length: 11 }, () => V))
    expect(summary.adoptedIndexes).toHaveLength(10)
    expect(summary.unusedValid).toBe(1)
  })

  it('keeps ten valid photos even when invalid files are mixed in', () => {
    // 11 张合规 + 2 张比例不合规 + 2 张格式不合规：采用前 10 张，1 张未使用。
    const summary = partitionUploads([V, T, V, R, V, V, T, V, R, V, V, V, V, V, V])
    expect(summary.adoptedIndexes).toHaveLength(10)
    expect(summary.unusedValid).toBe(1)
    expect(summary.ratioRejected).toBe(2)
    expect(summary.typeRejected).toBe(2)
  })

  it('never drops an adopted photo because of files after it', () => {
    // 前 10 张里有 1 张比例不合规：第 11 张合规照片应当补位，而不是整批被丢。
    const summary = partitionUploads([V, V, V, V, V, V, V, V, R, V, V])
    expect(summary.adoptedIndexes).toHaveLength(10)
    expect(summary.adoptedIndexes).toContain(10)
    expect(summary.ratioRejected).toBe(1)
  })

  it('reports the shortfall when fewer than ten photos are valid', () => {
    const summary = partitionUploads([...Array.from({ length: 9 }, () => V), R])
    expect(summary.adoptedIndexes).toHaveLength(9)
    expect(summary.ratioRejected).toBe(1)
  })
})
