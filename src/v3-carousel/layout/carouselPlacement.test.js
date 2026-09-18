import { describe, expect, it } from 'vitest'
import {
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  FITTING_SCALES,
  SIZE_RULES,
  STYLE_LAYOUTS,
  innerBox,
  matFor,
  placeFrame,
  planSmartStory,
  rngFrom,
} from './carouselPlacement.js'

const STYLES = Object.entries(STYLE_LAYOUTS)
const FRAME_ASPECT = .8

// 与 src/shared/demo.js 的 DEMO_DIMS 一致：默认 demo 数据就是这个比例结构。
const DEMO_DIMS = [
  [2400, 1800], [1200, 1600], [3000, 1200], [1400, 1400], [1200, 3000],
  [1600, 1200], [1200, 1600], [4000, 1500], [1600, 2000], [2000, 2000],
  [1200, 1600], [1600, 1200], [1800, 1800], [3200, 1300], [1400, 1800],
  [1200, 1600], [2000, 1400], [1600, 1600], [1400, 2000], [1800, 1200],
]
// 常规比例：aspect 0.75–1.33，不含超宽 / 超长。
const NORMAL_DIMS = [[2400, 1800], [1200, 1600], [1400, 1400], [1600, 1200], [1200, 1600], [1800, 1800]]

const COUNTS = Array.from({ length: 24 }, (_, index) => index + 1)
// 4128 是页面默认 seed；6 / 9 / 13 是实测能复现超宽图独占页的 seed，必须留在矩阵里。
const SEEDS = [1, 6, 7, 9, 13, 42, 77, 999, 4128, 123456, 2024]

const photosOf = (dims, count) => Array.from({ length: count }, (_, index) => {
  const [width, height] = dims[index % dims.length]
  return { id: `p${index}`, name: `p${index}.jpg`, width, height, previewSrc: '' }
})

const aspectOf = (photo) => photo.width / photo.height
// 内容区在页面里的物理比例：x/w 以页宽为 1，y/h 以页高为 1。
const physicalAspect = (box) => box.w * EXPORT_WIDTH / (box.h * EXPORT_HEIGHT)
const physicalShortEdge = (box) => Math.min(box.w, box.h / FRAME_ASPECT)
// 长边同样换算成「占页宽的比例」，用于判断照片有没有被缩到读不清。
const longEdge = (box) => Math.max(box.w, box.h / FRAME_ASPECT)

let cachedDemoRuns = null
function demoRuns() {
  if (!cachedDemoRuns) {
    cachedDemoRuns = []
    for (const count of COUNTS.filter((value) => value >= 4)) {
      for (const [styleId, layout] of STYLES) {
        for (const seed of SEEDS) {
          cachedDemoRuns.push({ count, styleId, seed, story: planSmartStory(photosOf(DEMO_DIMS, count), seed, layout) })
        }
      }
    }
  }
  return cachedDemoRuns
}

describe('V3 受控随机几何：硬边界', () => {
  it('照片内容区互不碰撞', () => {
    for (const { count, styleId, seed, story } of demoRuns()) {
      expect(story.contentCollisions, `count=${count} style=${styleId} seed=${seed}`).toBe(0)
    }
  })

  it('不拉伸照片：内容区比例与原始照片比例一致（误差 < 0.8%）', () => {
    // innerBox() 会用外卡片尺寸重新算一次 matFor()，而几何计算时的白边是按内容尺寸算的，
    // 两者可能差 1px，因此反推出的比例会有很小的偏差：实测最大 0.56%。
    for (const { story } of demoRuns()) {
      for (const frame of story.frames) {
        for (const card of frame.placed) {
          const aspect = aspectOf(card.photo)
          const error = Math.abs(physicalAspect(innerBox(card)) - aspect) / aspect
          expect(error, `${card.photo.name} aspect=${aspect.toFixed(3)}`).toBeLessThan(.008)
        }
      }
    }
  })

  it('白边在内容盒与外盒上的取整差不超过 1px', () => {
    // 这个 1px 差异就是上一条测试里 0.56% 误差的来源；它同时说明
    // innerBox() 只是内容区的近似值，而 CSS 真正渲染的 padding 用的是外盒的 matFor()。
    let maxDelta = 0
    for (const { story } of demoRuns()) {
      for (const frame of story.frames) {
        for (const card of frame.placed) {
          const outerMat = matFor({ w: card.w, h: card.h })
          const innerMat = matFor(innerBox(card))
          maxDelta = Math.max(maxDelta, Math.abs(outerMat - innerMat))
        }
      }
    }
    expect(maxDelta).toBeLessThanOrEqual(1)
  })

  it('内容短边 ≥ 20%、宽 ≤ 80%、高 ≤ 78%（demo 比例全部落在可行区间内）', () => {
    for (const { count, styleId, seed, story } of demoRuns()) {
      for (const frame of story.frames) {
        for (const card of frame.placed) {
          const inner = innerBox(card)
          const label = `count=${count} style=${styleId} seed=${seed} ${card.photo.name}`
          expect(physicalShortEdge(inner), label).toBeGreaterThanOrEqual(SIZE_RULES.minShortEdge - 1e-9)
          expect(inner.w, label).toBeLessThanOrEqual(SIZE_RULES.maxContentWidth + 1e-9)
          expect(inner.h, label).toBeLessThanOrEqual(SIZE_RULES.maxContentHeight + 1e-9)
        }
      }
    }
  })

  it('卡片始终留在页面内', () => {
    for (const { count, styleId, seed, story } of demoRuns()) {
      for (const frame of story.frames) {
        for (const card of frame.placed) {
          const label = `count=${count} style=${styleId} seed=${seed}`
          expect(card.x, label).toBeGreaterThanOrEqual(0)
          expect(card.y, label).toBeGreaterThanOrEqual(0)
          expect(card.x + card.w, label).toBeLessThanOrEqual(1 + 1e-9)
          expect(card.y + card.h, label).toBeLessThanOrEqual(1 + 1e-9)
        }
      }
    }
  })

  it('白边保持在 2–5px 的声明区间内', () => {
    const mats = new Set()
    for (const { story } of demoRuns()) {
      for (const frame of story.frames) {
        for (const card of frame.placed) {
          const mat = matFor({ w: card.w, h: card.h })
          expect(mat).toBeGreaterThanOrEqual(2)
          expect(mat).toBeLessThanOrEqual(5)
          mats.add(mat)
        }
      }
    }
    // 记录实测：合法尺寸下 matFor 只会取到 3–5px，2px 需要短边低于 15.4%。
    expect([...mats].every((mat) => mat >= 3)).toBe(true)
  })

  it('已知冲突：比例超出 1:4–4:1 时，20% 最小短边与 80% 最大宽度无法同时满足', () => {
    // 单张照片独占一页时的内容短边（占页宽的比例）。
    const shortEdgeFor = (aspect) => {
      const photo = { id: 'x', width: Math.round(aspect * 1000), height: 1000 }
      const frame = placeFrame([photo], rngFrom(11), STYLE_LAYOUTS.gallery, { id: 'smart', anchorShort: .43 })
      return physicalShortEdge(innerBox(frame.placed[0]))
    }
    expect(shortEdgeFor(3.8)).toBeGreaterThanOrEqual(SIZE_RULES.minShortEdge)
    expect(shortEdgeFor(0.22)).toBeGreaterThanOrEqual(SIZE_RULES.minShortEdge)
    // 4:1 与 1:4.88 是数学分界点：宽 80% 时内容短边正好 20%，再极端就必然低于 20%。
    expect(shortEdgeFor(4)).toBeCloseTo(SIZE_RULES.minShortEdge, 2)
    expect(shortEdgeFor(5)).toBeLessThan(SIZE_RULES.minShortEdge)
    expect(shortEdgeFor(0.2)).toBeLessThan(SIZE_RULES.minShortEdge)
  })
})

describe('V3 智能分页随机：整组规划', () => {
  it('每张输入照片恰好出现一次，不丢图不重复', () => {
    for (const { count, styleId, seed, story } of demoRuns()) {
      const ids = story.frames.flatMap((frame) => frame.placed.map((card) => card.photo.id))
      const label = `count=${count} style=${styleId} seed=${seed}`
      expect(ids, label).toHaveLength(count)
      expect(new Set(ids).size, label).toBe(count)
    }
  })

  it('相同 seed 与风格得到完全相同的页面几何', () => {
    for (const [styleId, layout] of STYLES) {
      for (const count of [4, 9, 13, 24]) {
        const first = planSmartStory(photosOf(DEMO_DIMS, count), 4128, layout)
        const second = planSmartStory(photosOf(DEMO_DIMS, count), 4128, layout)
        const canonical = (story) => JSON.stringify(story.frames.map((frame) => frame.placed.map(
          (card) => [card.photo.id, card.x, card.y, card.w, card.h, card.rotate],
        )))
        expect(canonical(first), `style=${styleId} count=${count}`).toBe(canonical(second))
        expect(first.pagePlan).toEqual(second.pagePlan)
      }
    }
  })

  it('三种风格共享同一套分页计划，只是表面气质不同', () => {
    for (const count of COUNTS) {
      for (const seed of SEEDS) {
        const plans = STYLES.map(([, layout]) => planSmartStory(photosOf(DEMO_DIMS, count), seed, layout).pagePlan.join(','))
        expect(new Set(plans).size, `count=${count} seed=${seed} -> ${plans.join(' | ')}`).toBe(1)
      }
    }
  })

  it('“换一组排法”只换 seed：照片集合不变，构图会变', () => {
    for (const count of [8, 10, 13, 24]) {
      const run = (seed) => planSmartStory(photosOf(DEMO_DIMS, count), seed, STYLE_LAYOUTS.weekend)
      const baseline = run(4128)
      const baselineIds = baseline.frames.flatMap((frame) => frame.placed.map((card) => card.photo.id)).sort()
      for (const seed of [1, 7, 999]) {
        const other = run(seed)
        const otherIds = other.frames.flatMap((frame) => frame.placed.map((card) => card.photo.id)).sort()
        expect(otherIds).toEqual(baselineIds)
        const geometry = (story) => JSON.stringify(story.frames.map((frame) => frame.placed.map((card) => [card.x, card.y, card.w, card.h])))
        expect(geometry(other), `count=${count} seed=${seed} 与 4128 的几何不应相同`).not.toBe(geometry(baseline))
      }
    }
  })

  it('输出页数不少于分页计划：放不下的照片顺延成补充页，而不是丢图', () => {
    for (const { count, styleId, seed, story } of demoRuns()) {
      const label = `count=${count} style=${styleId} seed=${seed} plan=${story.pagePlan.join(',')}`
      expect(story.frames.length, label).toBeGreaterThanOrEqual(story.pagePlan.length)
      expect(story.frames.every((frame) => frame.placed.length > 0), label).toBe(true)
    }
  })

  it('每页 2–4 张：自动缩放取代了以前「让一张照片顺延成单图页」的行为', () => {
    for (const { count, styleId, seed, story } of demoRuns()) {
      const sizes = story.frames.map((frame) => frame.placed.length)
      expect(sizes.filter((size) => size < 2), `count=${count} style=${styleId} seed=${seed} 出现单图页`).toHaveLength(0)
      expect(sizes.filter((size) => size > 4), `count=${count} style=${styleId} seed=${seed} 超过 4 张`).toHaveLength(0)
    }
    // 常规比例的照片集也不该出现单图页。
    for (const count of [6, 10, 13, 18, 24]) {
      for (const [styleId, layout] of STYLES) {
        for (const seed of SEEDS) {
          const story = planSmartStory(photosOf(NORMAL_DIMS, count), seed, layout)
          expect(story.frames.filter((frame) => frame.placed.length === 1), `常规比例 count=${count} style=${styleId} seed=${seed}`).toHaveLength(0)
        }
      }
    }
  })

  it('1–3 张照片仍然允许单独成页，不制造空页', () => {
    for (const count of [1, 2, 3]) {
      for (const [styleId, layout] of STYLES) {
        for (const seed of SEEDS) {
          const story = planSmartStory(photosOf(DEMO_DIMS, count), seed, layout)
          expect(story.pagePlan, `count=${count} style=${styleId}`).toEqual([count])
          expect(story.frames, `count=${count} style=${styleId}`).toHaveLength(1)
        }
      }
    }
  })

  it('自动缩放只在整页放不下时触发，缩到放得下为止', () => {
    let scaledFrames = 0
    for (const { count, styleId, seed, story } of demoRuns()) {
      for (const frame of story.frames) {
        const scale = frame.fittingScale ?? 1
        expect(scale, `count=${count} style=${styleId} seed=${seed}`).toBeLessThanOrEqual(1)
        expect(scale).toBeGreaterThanOrEqual(Math.min(...FITTING_SCALES))
        if (scale === 1) continue
        scaledFrames += 1
        // 缩放过的那一页必须真的把计划里的照片全放下了，否则缩放没有意义。
        expect(frame.unplaced, `count=${count} style=${styleId} seed=${seed} 缩放了却仍放不下`).toHaveLength(0)
      }
    }
    expect(scaledFrames, 'demo 数据里应该确实有需要缩放的页（超宽 + 超长配对）').toBeGreaterThan(0)
  })

  it('极端比例（1:5、5:1、8:1）也只占一页：不丢图、不碰撞，长边不缩到读不清', () => {
    const EXTREME_SETS = {
      超长: [[1200, 3000], [1000, 5000], [900, 3600], [1400, 3500]],
      超宽: [[3000, 1200], [4000, 1500], [5000, 1000], [3200, 1300]],
      超宽超长混合: [[5000, 1000], [1000, 5000], [3000, 1200], [1200, 3000]],
      八比一: [[8000, 1000], [1000, 8000], [5000, 1000], [1000, 5000]],
    }
    for (const [name, dims] of Object.entries(EXTREME_SETS)) {
      for (const count of [4, 6, 10, 13, 18, 24]) {
        for (const [styleId, layout] of STYLES) {
          for (const seed of SEEDS) {
            const photos = photosOf(dims, count)
            const story = planSmartStory(photos, seed, layout)
            const label = `${name} count=${count} style=${styleId} seed=${seed}`
            // 不丢图、不碰撞、不多出页，是自动缩放能不能兜住的底线。
            expect(story.frames.flatMap((frame) => frame.placed), label).toHaveLength(count)
            expect(story.contentCollisions, label).toBe(0)
            expect(story.frames.length, `${label} 输出页数应等于分页计划`).toBe(story.pagePlan.length)
            expect(story.frames.filter((frame) => frame.placed.length === 1), `${label} 出现单图页`).toHaveLength(0)
            // 极端比例的短边天然很小（5:1 全景在 80% 宽度下短边只有 16%），
            // 所以这里用长边作为「没有小到读不清」的判据：实测最差 41.6%。
            for (const card of story.frames.flatMap((frame) => frame.placed)) {
              const inner = innerBox(card)
              expect(longEdge(inner), `${label} aspect=${aspectOf(card.photo).toFixed(2)}`).toBeGreaterThanOrEqual(SIZE_RULES.minShortEdge - 1e-9)
            }
          }
        }
      }
    }
  })
})
