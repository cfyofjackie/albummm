import { describe, it, expect } from 'vitest'
import { classify } from './photo.js'
import { MIN_PHOTOS, MAX_PHOTOS, planPages } from './plan.js'

function makePhotos(specs) {
  // specs 为 [width, height] 对，id 按序号生成
  return specs.map(([w, h], i) => ({
    id: `p${i}`,
    width: w,
    height: h,
    orientation: classify(w, h),
  }))
}

const LANDSCAPE = [1600, 1200]
const PORTRAIT = [1200, 1600]
const SQUARE = [1400, 1400]
const ULTRA_WIDE = [3000, 1200]
const ULTRA_TALL = [1200, 3000]

function countByType(pages) {
  const counts = { cover: 0, back: 0, single: 0, double: 0, triple: 0 }
  for (const p of pages) counts[p.type]++
  return counts
}

describe('planPages 输入校验', () => {
  it('少于 5 张或超过 20 张时报错', () => {
    const one = makePhotos([LANDSCAPE])
    expect(() => planPages(one)).toThrow()
    expect(() => planPages(makePhotos(Array(MAX_PHOTOS + 1).fill(LANDSCAPE)))).toThrow()
  })

  it('未知风格时报错', () => {
    expect(() => planPages(makePhotos(Array(5).fill(LANDSCAPE)), 'collage')).toThrow()
  })
})

describe('planPages 结构不变量', () => {
  it.each([
    ['5 张全横图', makePhotos(Array(5).fill(LANDSCAPE))],
    ['7 张全竖图', makePhotos(Array(7).fill(PORTRAIT))],
    [
      '12 张混合',
      makePhotos(
        Array.from({ length: 12 }, (_, i) => [LANDSCAPE, PORTRAIT, SQUARE, ULTRA_WIDE][i % 4]),
      ),
    ],
    ['16 张含超长图', makePhotos(Array.from({ length: 16 }, (_, i) => [ULTRA_TALL, PORTRAIT, LANDSCAPE][i % 3]))],
    ['20 张全方图', makePhotos(Array(20).fill(SQUARE))],
  ])('%s：封面开头、封底结尾、图片恰好用一次、每页 1–3 张', (_, photos) => {
    for (const style of ['gallery', 'rhythm', 'frame']) {
      const pages = planPages(photos, style, 'test-seed')
      expect(pages[0].type).toBe('cover')
      expect(pages.at(-1).type).toBe('back')
      expect(pages[0].imageIds).toEqual([])
      expect(pages.at(-1).imageIds).toEqual([])

      const used = pages.flatMap((p) => p.imageIds)
      expect(used).toHaveLength(photos.length)
      expect(new Set(used).size).toBe(photos.length)
      const ids = new Set(photos.map((p) => p.id))
      for (const id of used) expect(ids.has(id)).toBe(true)

      for (const p of pages.slice(1, -1)) {
        expect(p.imageIds.length).toBeGreaterThanOrEqual(1)
        expect(p.imageIds.length).toBeLessThanOrEqual(3)
        if (p.type === 'single') expect(p.imageIds).toHaveLength(1)
        if (p.type === 'double') expect(p.imageIds).toHaveLength(2)
        if (p.type === 'triple') expect(p.imageIds).toHaveLength(3)
      }
    }
  })
})

describe('数量分档策略', () => {
  it('5–7 张：最多 1 个双图页，无三图页', () => {
    for (const n of [5, 6, 7]) {
      const photos = makePhotos(
        Array.from({ length: n }, (_, i) => [LANDSCAPE, PORTRAIT, SQUARE][i % 3]),
      )
      for (const style of ['gallery', 'rhythm', 'frame']) {
        const { double, triple, single } = countByType(planPages(photos, style, 's'))
        expect(double).toBeLessThanOrEqual(1)
        expect(triple).toBe(0)
        expect(single).toBeGreaterThanOrEqual(n - 2)
      }
    }
  })

  it('8–12 张：至多 1 个三图页', () => {
    const photos = makePhotos(
      Array.from({ length: 10 }, (_, i) => [LANDSCAPE, PORTRAIT, ULTRA_WIDE, SQUARE][i % 4]),
    )
    for (const style of ['gallery', 'rhythm', 'frame']) {
      expect(countByType(planPages(photos, style, 's')).triple).toBeLessThanOrEqual(1)
    }
  })

  it('13–20 张：rhythm 增加双图页，但仍保留单图页', () => {
    const photos = makePhotos(
      Array.from({ length: 16 }, (_, i) => [LANDSCAPE, PORTRAIT, SQUARE, ULTRA_WIDE][i % 4]),
    )
    const counts = countByType(planPages(photos, 'rhythm', 's'))
    expect(counts.double).toBeGreaterThanOrEqual(2)
    expect(counts.single).toBeGreaterThanOrEqual(3)
    expect(counts.triple).toBeLessThanOrEqual(2)
  })
})

describe('风格差异', () => {
  const photos = makePhotos(
    Array.from({ length: 12 }, (_, i) => [LANDSCAPE, PORTRAIT, SQUARE][i % 3]),
  )

  it('frame 不使用接近满页的 single-full', () => {
    const pages = planPages(photos, 'frame', 's')
    const layoutIds = pages.map((p) => p.layoutId)
    expect(layoutIds).not.toContain('single-full')
  })

  it('开篇页是面积最大的照片', () => {
    const big = { id: 'big', width: 2400, height: 1800, orientation: 'landscape' }
    const small = makePhotos(Array(9).fill(SQUARE))
    const pages = planPages([big, ...small], 'gallery', 's')
    const firstSingle = pages.find((p) => p.type === 'single')
    expect(firstSingle.imageIds).toEqual(['big'])
  })

  it('rhythm 开篇优先接近满页，gallery 开篇居中', () => {
    const firstSingle = (style) =>
      planPages(photos, style, 's').find((p) => p.type === 'single').layoutId
    expect(firstSingle('rhythm')).toBe('single-full')
    expect(firstSingle('gallery')).toBe('single-center')
  })
})

describe('方向驱动排版', () => {
  it('single-full 不用于超宽/超长图', () => {
    const photos = makePhotos(Array.from({ length: 10 }, (_, i) => [ULTRA_WIDE, ULTRA_TALL][i % 2]))
    for (const style of ['gallery', 'rhythm', 'frame']) {
      for (const page of planPages(photos, style, 's')) {
        if (page.type === 'single' && page.layoutId === 'single-full') {
          const photo = photos.find((p) => p.id === page.imageIds[0])
          expect(['ultra-wide', 'ultra-tall']).not.toContain(photo.orientation)
        }
      }
    }
  })

  it('超宽图优先进入三图页，且全横图组合用 triple-row', () => {
    const photos = makePhotos(
      Array.from({ length: 11 }, (_, i) => [ULTRA_WIDE, LANDSCAPE, PORTRAIT, LANDSCAPE, PORTRAIT, LANDSCAPE][i % 6]),
    )
    let placed = false
    for (const style of ['gallery', 'rhythm']) {
      for (const page of planPages(photos, style, 's')) {
        if (page.type !== 'triple') continue
        const members = page.imageIds.map((id) => photos.find((p) => p.id === id))
        if (members.every((m) => isWideish(m))) {
          expect(page.layoutId).toBe('triple-row')
          placed = true
        } else if (members.some((m) => m.orientation === 'ultra-wide')) {
          // 含超宽但非全横的组合：超宽必须占主位
          const firstMember = members[0]
          expect(['ultra-wide', 'ultra-tall'].includes(firstMember.orientation) || isWideish(firstMember)).toBe(true)
        }
      }
    }
    expect(placed).toBe(true)
  })

  it('全竖图不产生双图页（竖图优先单独成页），全横图的 double 页用上下排', () => {
    const portraitPages = planPages(makePhotos(Array(10).fill(PORTRAIT)), 'rhythm', 's')
    expect(portraitPages.filter((p) => p.type === 'double')).toHaveLength(0)

    const landscapePages = planPages(makePhotos(Array(10).fill(LANDSCAPE)), 'rhythm', 's')
    const landscapeDoubles = landscapePages.filter((p) => p.type === 'double')
    expect(landscapeDoubles.length).toBeGreaterThan(0)
    expect(landscapeDoubles.every((p) => p.layoutId === 'double-stack')).toBe(true)
  })

  it('任何 double 页都不含竖图（V0.5：双图页只由横图/方图对构成）', () => {
    const fixtures = [
      makePhotos(Array.from({ length: 12 }, (_, i) => [LANDSCAPE, PORTRAIT, SQUARE, PORTRAIT][i % 4])),
      makePhotos(Array.from({ length: 16 }, (_, i) => [PORTRAIT, PORTRAIT, LANDSCAPE, ULTRA_WIDE][i % 4])),
    ]
    for (const photos of fixtures) {
      for (const style of ['gallery', 'rhythm', 'frame']) {
        for (let seed = 1; seed <= 3; seed++) {
          for (const page of planPages(photos, style, seed)) {
            if (page.type !== 'double') continue
            const members = page.imageIds.map((id) => photos.find((p) => p.id === id))
            expect(members.every(isWideish)).toBe(true)
          }
        }
      }
    }
  })

  it('竖图相册出现上顶/下顶单图页（留白节奏）', () => {
    const photos = makePhotos(Array.from({ length: 10 }, () => PORTRAIT))
    const layouts = new Set()
    for (let seed = 1; seed <= 8; seed++) {
      for (const page of planPages(photos, 'gallery', seed)) {
        if (page.type === 'single') layouts.add(page.layoutId)
      }
    }
    expect(layouts.has('single-top') || layouts.has('single-bottom')).toBe(true)
  })
})

describe('确定性', () => {
  const photos = makePhotos(
    Array.from({ length: 12 }, (_, i) => [LANDSCAPE, PORTRAIT, SQUARE, ULTRA_WIDE][i % 4]),
  )

  it('同 seed 结果完全一致', () => {
    const a = planPages(photos, 'rhythm', 'album-42')
    const b = planPages(photos, 'rhythm', 'album-42')
    expect(a).toEqual(b)
  })

  it('不同 seed 产生不同排版', () => {
    const results = new Set(
      [1, 2, 3, 4, 5].map((seed) => JSON.stringify(planPages(photos, 'rhythm', seed))),
    )
    expect(results.size).toBeGreaterThan(1)
  })
})

function isWideish(p) {
  return ['landscape', 'square', 'ultra-wide'].includes(p.orientation)
}
