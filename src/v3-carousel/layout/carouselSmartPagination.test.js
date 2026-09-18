import { describe, expect, it } from 'vitest'
import { pageCountPlan, paginatePhotos } from './carouselSmartPagination.js'

// 固定种子 PRNG：分页模块只依赖一个 random() 函数，测试不引入几何层。
function rngFrom(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COUNTS = Array.from({ length: 24 }, (_, index) => index + 1)
const SEEDS = [1, 2, 3, 7, 42, 77, 999, 4128, 65535, 123456, 987654321, 2 ** 31 - 1]

// 与 src/shared/demo.js 的 DEMO_DIMS 一致：横 / 竖 / 超宽 / 方 / 超长混合。
const DEMO_DIMS = [
  [2400, 1800], [1200, 1600], [3000, 1200], [1400, 1400], [1200, 3000],
  [1600, 1200], [1200, 1600], [4000, 1500], [1600, 2000], [2000, 2000],
  [1200, 1600], [1600, 1200], [1800, 1800], [3200, 1300], [1400, 1800],
  [1200, 1600], [2000, 1400], [1600, 1600], [1400, 2000], [1800, 1200],
]

function photosOf(dims, count) {
  return Array.from({ length: count }, (_, index) => {
    const [width, height] = dims[index % dims.length]
    return { id: `p${index}`, name: `p${index}.jpg`, width, height, previewSrc: '' }
  })
}

const aspectKind = (photo) => {
  const aspect = photo.width / photo.height
  if (aspect < .85) return 'portrait'
  if (aspect > 1.25) return 'landscape'
  return 'square'
}

describe('V3 智能分页：数量与页数', () => {
  it('1–24 张照片在分页计划里数量守恒', () => {
    for (const count of COUNTS) {
      for (const seed of SEEDS) {
        const plan = pageCountPlan(count, rngFrom(seed))
        expect(plan.reduce((sum, size) => sum + size, 0), `count=${count} seed=${seed}`).toBe(count)
        expect(plan.length).toBeGreaterThan(0)
      }
    }
  })

  it('4 张以上每页只有 2、3 或 4 张；1–3 张允许单页例外', () => {
    for (const count of COUNTS) {
      for (const seed of SEEDS) {
        const plan = pageCountPlan(count, rngFrom(seed))
        if (count <= 3) {
          expect(plan).toEqual([count])
          continue
        }
        for (const size of plan) {
          expect([2, 3, 4], `count=${count} seed=${seed} plan=${plan.join(',')}`).toContain(size)
        }
      }
    }
  })

  it('2 张页多于 3 张页（5 张照片是唯一做不到的例外）', () => {
    // 5 张只能拆成 2+3，两张页数相等是算术上不可避免的，不是算法缺陷。
    for (const seed of SEEDS) {
      const plan = pageCountPlan(5, rngFrom(seed))
      expect([...plan].sort()).toEqual([2, 3])
    }
    for (const count of COUNTS.filter((value) => value >= 6)) {
      for (const seed of SEEDS) {
        const plan = pageCountPlan(count, rngFrom(seed))
        const twos = plan.filter((size) => size === 2).length
        const threes = plan.filter((size) => size === 3).length
        expect(twos, `count=${count} seed=${seed} plan=${plan.join(',')}`).toBeGreaterThan(threes)
      }
    }
  })

  it('4 张页最多出现一次，且不会落在开头或结尾', () => {
    for (const count of COUNTS) {
      for (const seed of SEEDS) {
        const plan = pageCountPlan(count, rngFrom(seed))
        const fours = plan.filter((size) => size === 4).length
        expect(fours, `count=${count} seed=${seed}`).toBeLessThanOrEqual(1)
        if (fours === 1) {
          const index = plan.indexOf(4)
          expect(index, `count=${count} seed=${seed} plan=${plan.join(',')}`).toBeGreaterThan(0)
          expect(index).toBeLessThan(plan.length - 1)
        }
      }
    }
  })

  it('10–13 张优先五页；照片更多时宁可加页，也不把 24 张硬塞进八页', () => {
    for (const count of [10, 11, 12, 13]) {
      for (const seed of SEEDS) {
        expect(pageCountPlan(count, rngFrom(seed)).length, `count=${count}`).toBe(5)
      }
    }
    for (const count of COUNTS.filter((value) => value >= 14)) {
      for (const seed of SEEDS) {
        const pages = pageCountPlan(count, rngFrom(seed)).length
        expect(pages).toBeGreaterThanOrEqual(5)
        expect(pages).toBeLessThanOrEqual(Math.ceil(count / 2))
      }
    }
    for (const seed of SEEDS) {
      expect(pageCountPlan(24, rngFrom(seed)).length).toBe(10)
    }
  })

  it('10 张照片的页数方案唯一：换 seed 只改变每页内部的构图', () => {
    // 10 = 2×5 是唯一满足「两张页多于三张页」且不出现四张页的分解。
    const shapes = new Set(SEEDS.map((seed) => pageCountPlan(10, rngFrom(seed)).join(',')))
    expect(shapes.size).toBe(1)
    expect([...shapes][0]).toBe('2,2,2,2,2')
  })

  it('相同 seed 得到完全相同的计划', () => {
    for (const count of COUNTS) {
      const first = pageCountPlan(count, rngFrom(20240918))
      const second = pageCountPlan(count, rngFrom(20240918))
      expect(first).toEqual(second)
    }
  })
})

describe('V3 智能分页：照片分配', () => {
  it('不丢图、不重复，每页张数与计划一致', () => {
    for (const count of COUNTS) {
      for (const seed of SEEDS) {
        const photos = photosOf(DEMO_DIMS, count)
        const groups = paginatePhotos(photos, rngFrom(seed))
        const plan = pageCountPlan(count, rngFrom(seed))

        expect(groups.map((group) => group.length), `count=${count} seed=${seed}`).toEqual(plan)
        const ids = groups.flat().map((photo) => photo.id)
        expect(ids).toHaveLength(count)
        expect(new Set(ids).size).toBe(count)
      }
    }
  })

  it('保留上传顺序的叙事感：每页第一张是尚未使用的最前一张', () => {
    for (const count of [8, 10, 13, 18, 24]) {
      for (const seed of SEEDS) {
        const photos = photosOf(DEMO_DIMS, count)
        const groups = paginatePhotos(photos, rngFrom(seed))
        const expected = [...photos]
        for (const group of groups) {
          expect(group[0].id, `count=${count} seed=${seed}`).toBe(expected.shift().id)
          for (const photo of group.slice(1)) {
            const index = expected.findIndex((item) => item.id === photo.id)
            expect(index, `${photo.id} 不在剩余照片中`).toBeGreaterThanOrEqual(0)
            expected.splice(index, 1)
          }
        }
        expect(expected).toHaveLength(0)
      }
    }
  })

  it('混合比例优先把横图与竖图配成对', () => {
    // 实测：8 张混合比例照片在 200 个固定种子下，2 张页 100% 是异向组合。
    let pairs = 0
    let sameKind = 0
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const group of paginatePhotos(photosOf(DEMO_DIMS.slice(0, 8), 8), rngFrom(seed))) {
        if (group.length !== 2) continue
        pairs += 1
        if (aspectKind(group[0]) === aspectKind(group[1])) sameKind += 1
      }
    }
    expect(pairs).toBeGreaterThan(0)
    expect(sameKind).toBe(0)
  })

  it('全部同向或全是方图时仍然满足数量规则', () => {
    const sets = {
      全横: [[2400, 1800], [1600, 1200], [3000, 1200]],
      全竖: [[1200, 1600], [1400, 2000], [1200, 3000]],
      方图: [[1400, 1400], [2000, 2000], [1800, 1800]],
    }
    for (const [name, dims] of Object.entries(sets)) {
      for (const count of [5, 8, 13, 24]) {
        for (const seed of SEEDS) {
          const groups = paginatePhotos(photosOf(dims, count), rngFrom(seed))
          expect(groups.flat(), `${name} count=${count}`).toHaveLength(count)
          for (const group of groups) expect(group.length).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })
})
