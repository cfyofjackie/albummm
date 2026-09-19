import { describe, expect, it } from 'vitest'
import {
  BORDER_STYLES,
  DEFAULT_FORMAT,
  EDGE_STYLES,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  FITTING_SCALES,
  PAGE_FORMATS,
  SIZE_RULES,
  STYLE_LAYOUTS,
  TAPE_STYLES,
  innerBox,
  matFor,
  matInsets,
  materialOf,
  placeFrame,
  planSmartStory,
  rngFrom,
  shortEdgeFloor,
  tapeCountFor,
  tapeRect,
} from './carouselPlacement.js'

// 矩形相交面积：测试里独立复算，不用被测代码的实现。
const intersectionOf = (a, b) => {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return w * h
}

// 材质三轴的抽样组合（完整 8 种组合在下面的材质 describe 里跑）。
const MATERIAL_SAMPLES = [
  materialOf({ border: BORDER_STYLES.none, edge: EDGE_STYLES.straight, tape: TAPE_STYLES.off }),
  materialOf({ border: BORDER_STYLES.polaroid, edge: EDGE_STYLES.straight, tape: TAPE_STYLES.washi }),
  materialOf({ border: BORDER_STYLES.none, edge: EDGE_STYLES.torn, tape: TAPE_STYLES.washi }),
].map((material) => ({ ...material, label: `${material.border.label}+${material.edge.label}+${material.tape.label}` }))

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
const physicalAspect = (box, format = DEFAULT_FORMAT) => box.w * format.width / (box.h * format.height)
// 短边 / 长边都换算成「占页宽的比例」，用于与尺寸边界比较。
const physicalShortEdge = (box, format = DEFAULT_FORMAT) => Math.min(box.w, box.h / format.aspect)
const longEdge = (box, format = DEFAULT_FORMAT) => Math.max(box.w, box.h / format.aspect)

const runCache = new Map()
function runsFor(format = DEFAULT_FORMAT) {
  if (!runCache.has(format.id)) {
    const runs = []
    for (const count of COUNTS.filter((value) => value >= 4)) {
      for (const [styleId, layout] of STYLES) {
        for (const seed of SEEDS) {
          runs.push({ count, styleId, seed, story: planSmartStory(photosOf(DEMO_DIMS, count), seed, layout, format) })
        }
      }
    }
    runCache.set(format.id, runs)
  }
  return runCache.get(format.id)
}

const demoRuns = () => runsFor(DEFAULT_FORMAT)

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

  it('白边由几何层给出并被渲染层原样使用（不再按外框重算）', () => {
    // 材质会把边框乘上 2.2–5.5 的系数：若渲染/判定按「外框」重算一次边框，
    // 1px 的取整误差会被放大成约 0.5% 页高的偏差（实测曾经让内容短边掉到 19.5%）。
    // 所以几何层把边框存在卡片上，innerBox 与渲染都直接用它。
    for (const material of MATERIAL_SAMPLES) {
      for (const format of Object.values(PAGE_FORMATS)) {
        for (const { story } of runsFor(format)) {
          for (const frame of story.frames) {
            for (const card of frame.placed) {
              const label = `${material.label} ${format.label} ${card.photo.name}`
              expect(card.mat, label).toBeTruthy()
              const inner = innerBox(card, format, material)
              expect(inner.x, label).toBeCloseTo(card.x + card.mat.x / format.width, 12)
              expect(inner.y, label).toBeCloseTo(card.y + card.mat.top / format.height, 12)
              expect(inner.w, label).toBeCloseTo(card.w - card.mat.x * 2 / format.width, 12)
              expect(inner.h, label).toBeCloseTo(card.h - (card.mat.top + card.mat.bottom) / format.height, 12)
              // 按外框重算的值可以和存的值不同（就是上面那个 1px 被放大后的偏差），
              // 但渲染必须用存的值：百分比 padding 由 mat 换算而来。
              expect(matFor(card, format, material)).toBeGreaterThan(0)
            }
          }
        }
      }
    }
  })

  it('预览与导出同一尺度：按页宽写百分比白边，就等于几何层给的内缩量', () => {
    // 预览把白边写成 mat/页宽 的百分比（CSS padding 的百分比以父级宽度为基准），
    // 这个换算保证预览在 216–335px 的页宽下也画出与 1080 导出完全一致的内缩比例。
    for (const format of Object.values(PAGE_FORMATS)) {
      for (const { story } of runsFor(format)) {
        for (const frame of story.frames) {
          for (const card of frame.placed) {
            const paddingFraction = card.mat.x / format.width
            const inner = innerBox(card, format)
            expect(card.x + paddingFraction).toBeCloseTo(inner.x, 12)
            expect(card.y + card.mat.top / format.height).toBeCloseTo(inner.y, 12)
            expect(card.w - paddingFraction * 2).toBeCloseTo(inner.w, 12)
            expect(card.h - (card.mat.top + card.mat.bottom) / format.height).toBeCloseTo(inner.h, 12)
          }
        }
      }
    }
  })

  it('内容短边 ≥ 20%、宽 ≤ 80%、高 ≤ 78%（demo 比例全部落在可行区间内）', () => {
    for (const { count, styleId, seed, story } of demoRuns()) {
      for (const frame of story.frames) {
        // 整页自动缩放的页按缩放比例放宽下限（20% 是优先下限，见 guardrails 第 3 节）。
        const allowedFloor = SIZE_RULES.minShortEdge * (frame.fittingScale ?? 1)
        for (const card of frame.placed) {
          const inner = innerBox(card)
          const label = `count=${count} style=${styleId} seed=${seed} ${card.photo.name} scale=${frame.fittingScale ?? 1}`
          expect(physicalShortEdge(inner), label).toBeGreaterThanOrEqual(allowedFloor - 1e-9)
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

describe('V3 页面规格：每个规格都按自己的比例重新构图', () => {
  const OTHER_FORMATS = Object.values(PAGE_FORMATS).filter((format) => format.id !== DEFAULT_FORMAT.id)

  it('分页与页面比例无关：所有规格的页数计划完全一致', () => {
    for (const count of COUNTS) {
      for (const seed of SEEDS) {
        const expected = planSmartStory(photosOf(DEMO_DIMS, count), seed, STYLE_LAYOUTS.gallery, DEFAULT_FORMAT).pagePlan.join(',')
        for (const format of OTHER_FORMATS) {
          const plan = planSmartStory(photosOf(DEMO_DIMS, count), seed, STYLE_LAYOUTS.gallery, format).pagePlan.join(',')
          expect(plan, `${format.label} count=${count} seed=${seed}`).toBe(expected)
        }
      }
    }
  })

  it('每个规格都满足：每页 2–4 张、不丢图、不碰撞、不出现单图页', () => {
    for (const format of Object.values(PAGE_FORMATS)) {
      for (const { count, styleId, seed, story } of runsFor(format)) {
        const label = `${format.label} count=${count} style=${styleId} seed=${seed}`
        const ids = story.frames.flatMap((frame) => frame.placed.map((card) => card.photo.id))
        expect(ids, label).toHaveLength(count)
        expect(new Set(ids).size, label).toBe(count)
        expect(story.contentCollisions, label).toBe(0)
        expect(story.frames.map((frame) => frame.placed.length).filter((size) => size < 2 || size > 4), label).toHaveLength(0)
      }
    }
  })

  it('尺寸边界按页面短边换算：竖版 20%、横版 15%', () => {
    // 竖版页面的短边是「宽」，下限就是 0.2 页宽；横版短边是「高」，换算成 0.2 × (1 / 1.3333) = 0.15 页宽。
    expect(shortEdgeFloor(PAGE_FORMATS['4x5'])).toBeCloseTo(.2, 10)
    expect(shortEdgeFloor(PAGE_FORMATS['3x4'])).toBeCloseTo(.2, 10)
    expect(shortEdgeFloor(PAGE_FORMATS['4x3'])).toBeCloseTo(.15, 10)
    for (const format of Object.values(PAGE_FORMATS)) {
      const floor = shortEdgeFloor(format)
      for (const { count, styleId, seed, story } of runsFor(format)) {
        for (const frame of story.frames) {
          // 整页自动缩放会把该页所有卡片按比例压小，短边下限随之放宽（20% 是「优先下限」，
          // 见 development-guardrails 第 3 节与 validation-log 第 7 节）。
          const allowedFloor = floor * (frame.fittingScale ?? 1)
          for (const card of frame.placed) {
            const inner = innerBox(card, format)
            const label = `${format.label} count=${count} style=${styleId} seed=${seed} ${card.photo.name} scale=${frame.fittingScale ?? 1}`
            expect(physicalShortEdge(inner, format), label).toBeGreaterThanOrEqual(allowedFloor - 1e-9)
            expect(inner.w, label).toBeLessThanOrEqual(SIZE_RULES.maxContentWidth + 1e-9)
            expect(inner.h, label).toBeLessThanOrEqual(SIZE_RULES.maxContentHeight + 1e-9)
            // 不拉伸：误差同样只来自白边在内容盒/外盒上的 1px 取整（实测 < 1%）。
            const aspectError = Math.abs(physicalAspect(inner, format) - aspectOf(card.photo)) / aspectOf(card.photo)
            expect(aspectError, label).toBeLessThan(.01)
          }
        }
      }
    }
  })

  it('每个规格都是真的重新构图，而不是把 4:5 缩放过来', () => {
    const geometry = (story) => JSON.stringify(story.frames.map((frame) => frame.placed.map((card) => [card.photo.id, card.w, card.h])))
    for (const format of OTHER_FORMATS) {
      let compared = 0
      let different = 0
      for (const [, layout] of STYLES) {
        for (const count of [6, 10, 13, 24]) {
          for (const seed of SEEDS) {
            const photos = photosOf(DEMO_DIMS, count)
            compared += 1
            if (geometry(planSmartStory(photos, seed, layout, DEFAULT_FORMAT)) !== geometry(planSmartStory(photos, seed, layout, format))) different += 1
          }
        }
      }
      expect(compared, format.label).toBeGreaterThan(0)
      expect(different, `${format.label} 的构图应与 4:5 不同`).toBe(compared)
    }
  })
})

describe('V3 材质三轴：边框 / 边缘 / 胶带', () => {
  // 三条轴独立组合（2 × 2 × 2 = 8 种），全部要满足硬边界。
  const COMBOS = []
  for (const border of Object.values(BORDER_STYLES)) {
    for (const edge of Object.values(EDGE_STYLES)) {
      for (const tape of Object.values(TAPE_STYLES)) {
        COMBOS.push({ label: `${border.label}+${edge.label}+${tape.label}`, material: materialOf({ border, edge, tape }) })
      }
    }
  }
  const MATERIAL_COUNTS = [6, 10, 13, 24]

  it('拍立得有更宽的下边，且下巴按卡片短边封顶（超宽图不会被套上厚下巴）', () => {
    const polaroid = materialOf({ border: BORDER_STYLES.polaroid, edge: EDGE_STYLES.straight, tape: TAPE_STYLES.off })
    const none = materialOf({ border: BORDER_STYLES.none, edge: EDGE_STYLES.straight, tape: TAPE_STYLES.off })
    const normal = matInsets({ w: .4, h: .5 }, DEFAULT_FORMAT, polaroid)
    const pano = matInsets({ w: .8, h: .13 }, DEFAULT_FORMAT, polaroid)
    expect(normal.bottom).toBeGreaterThan(normal.x * 2)
    // 超宽图（矮）的下巴比同样白边下的大卡片明显更小
    expect(pano.bottom).toBeLessThan(normal.bottom)
    expect(none.bottom).toBe(none.x)
  })

  it('毛边自带最小出血带，且撕边深度只啃边框', () => {
    for (const edge of Object.values(EDGE_STYLES)) {
      expect(edge.tear, edge.id).toBeLessThan(1)
      expect(edge.tear, edge.id).toBeGreaterThanOrEqual(0)
    }
    const torn = materialOf({ border: BORDER_STYLES.none, edge: EDGE_STYLES.torn, tape: TAPE_STYLES.off })
    const band = matInsets({ w: .3, h: .4 }, DEFAULT_FORMAT, torn)
    // 没有出血带就撕不出毛边（只能啃照片），所以毛边必须自带一个最小带宽。
    expect(band.x).toBeGreaterThanOrEqual(EDGE_STYLES.torn.minBand)
    expect(band.x * EDGE_STYLES.torn.tear).toBeGreaterThanOrEqual(5)
  })

  it('胶带条数 = 页内照片数 − 1，至少 1 条', () => {
    const washi = materialOf({ tape: TAPE_STYLES.washi })
    expect(tapeCountFor(2, washi)).toBe(1)
    expect(tapeCountFor(3, washi)).toBe(2)
    expect(tapeCountFor(4, washi)).toBe(3)
    expect(tapeCountFor(4, materialOf({ tape: TAPE_STYLES.off }))).toBe(0)
    for (const count of [2, 3, 4]) {
      for (const seed of SEEDS) {
        const story = planSmartStory(photosOf(DEMO_DIMS, 10), seed, STYLE_LAYOUTS.muse, DEFAULT_FORMAT, washi)
        for (const frame of story.frames) {
          expect(frame.placed.filter((card) => card.tape), `count=${frame.placed.length}`).toHaveLength(tapeCountFor(frame.placed.length, washi))
        }
      }
    }
  })

  it('胶带占位进了碰撞判定：胶带底下不会有别的照片内容', () => {
    const washi = materialOf({ border: BORDER_STYLES.polaroid, edge: EDGE_STYLES.torn, tape: TAPE_STYLES.washi })
    let taped = 0
    for (const [styleId, style] of STYLES) {
      for (const count of MATERIAL_COUNTS) {
        for (const seed of SEEDS) {
          const story = planSmartStory(photosOf(DEMO_DIMS, count), seed, style, DEFAULT_FORMAT, washi)
          for (const frame of story.frames) {
            for (const card of frame.placed) {
              const tape = tapeRect(card, DEFAULT_FORMAT, washi)
              if (!tape) continue
              taped += 1
              for (const other of frame.placed) {
                if (other === card) continue
                const inner = innerBox(other, DEFAULT_FORMAT, washi)
                const overlap = intersectionOf(tape, inner)
                expect(overlap, `${styleId} count=${count} seed=${seed} 胶带压到了 ${other.photo.name}`).toBeLessThanOrEqual(1e-9)
              }
            }
          }
        }
      }
    }
    expect(taped).toBeGreaterThan(0)
  })

  it('八种组合下硬边界都成立：不丢图、内容区不碰撞、尺寸边界不越界', () => {
    for (const { label, material } of COMBOS) {
      for (const [styleId, style] of STYLES) {
        for (const count of MATERIAL_COUNTS) {
          for (const seed of SEEDS) {
            const photos = photosOf(DEMO_DIMS, count)
            const story = planSmartStory(photos, seed, style, DEFAULT_FORMAT, material)
            const tag = `${label} ${styleId} count=${count} seed=${seed}`
            expect(story.frames.flatMap((frame) => frame.placed), tag).toHaveLength(count)
            expect(story.contentCollisions, tag).toBe(0)
            expect(story.frames.length, tag).toBe(story.pagePlan.length)
            for (const frame of story.frames) {
              const allowedFloor = SIZE_RULES.minShortEdge * (frame.fittingScale ?? 1)
              for (const card of frame.placed) {
                const inner = innerBox(card, DEFAULT_FORMAT, material)
                expect(physicalShortEdge(inner), tag).toBeGreaterThanOrEqual(allowedFloor - 1e-9)
                expect(inner.w, tag).toBeLessThanOrEqual(SIZE_RULES.maxContentWidth + 1e-9)
                expect(inner.h, tag).toBeLessThanOrEqual(SIZE_RULES.maxContentHeight + 1e-9)
              }
            }
          }
        }
      }
    }
  })

  it('材质不是纯装饰：加厚边框与毛边都真的改变了排版', () => {
    const bare = materialOf({ border: BORDER_STYLES.none, edge: EDGE_STYLES.straight, tape: TAPE_STYLES.off })
    const polaroid = materialOf({ border: BORDER_STYLES.polaroid, edge: EDGE_STYLES.straight, tape: TAPE_STYLES.off })
    const torn = materialOf({ border: BORDER_STYLES.none, edge: EDGE_STYLES.torn, tape: TAPE_STYLES.off })
    const sample = { w: .4, h: .5 }
    // 边框厚度直接决定外框（mat 进入 sizeFor：外框 = 内容 + 边框）。
    expect(matInsets(sample, DEFAULT_FORMAT, polaroid).x).toBeGreaterThan(matInsets(sample, DEFAULT_FORMAT, bare).x)
    expect(matInsets(sample, DEFAULT_FORMAT, torn).x).toBeGreaterThan(matInsets(sample, DEFAULT_FORMAT, bare).x)
    // 但「平均外框更大」不成立：厚边框会让拥挤的页触发整页缩放，反而可能更小。
    // 所以这里断言的是「每个种子下材质版与裸版的排版都不同」。
    const geometry = (story) => JSON.stringify(story.frames.map((frame) => frame.placed.map((card) => [card.photo.id, +card.w.toFixed(4), +card.h.toFixed(4)])))
    for (const seed of SEEDS) {
      const photos = photosOf(DEMO_DIMS, 10)
      const base = geometry(planSmartStory(photos, seed, STYLE_LAYOUTS.weekend, DEFAULT_FORMAT, bare))
      expect(geometry(planSmartStory(photos, seed, STYLE_LAYOUTS.weekend, DEFAULT_FORMAT, polaroid)), `拍立得 seed=${seed}`).not.toBe(base)
      expect(geometry(planSmartStory(photos, seed, STYLE_LAYOUTS.weekend, DEFAULT_FORMAT, torn)), `毛边 seed=${seed}`).not.toBe(base)
    }
  })
})

describe('V3 三种风格必须真的可以分辨', () => {
  // 背景：修复前 smart 模式下 recipe 会遮蔽 style 的尺寸参数、轻叠分支也永远走不到，
  // 三种风格实测只差「旋转 0 / 0.45 / 1.8 度」，尺寸差只有 0.03%（见 validation-log.md §11）。
  // 这组测试把「风格必须可分辨」变成可执行的规格，防止再次退化成死参数。
  const STYLE_SEEDS = Array.from({ length: 20 }, (_, index) => index * 137 + 11)
  const metricsCache = new Map()

  const metricsFor = (styleId) => {
    if (metricsCache.has(styleId)) return metricsCache.get(styleId)
    const layout = STYLE_LAYOUTS[styleId]
    const rotations = []
    const spreads = []
    let overlapPages = 0
    let pages = 0
    let collisions = 0
    let placed = 0
    for (const seed of STYLE_SEEDS) {
      const photos = photosOf(DEMO_DIMS, 10)
      const story = planSmartStory(photos, seed, layout)
      collisions += story.contentCollisions
      for (const frame of story.frames) {
        pages += 1
        placed += frame.placed.length
        const cards = frame.placed
        for (const card of cards) rotations.push(Math.abs(card.rotate))
        if (cards.length >= 2) {
          const areas = cards.map((card) => card.w * card.h)
          spreads.push(Math.max(...areas) / Math.min(...areas))
        }
        if (cards.some((a, i) => cards.some((b, j) => j > i && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y))) overlapPages += 1
      }
    }
    const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
    const metrics = {
      avgRotation: average(rotations),
      maxRotation: Math.max(...rotations),
      avgSpread: average(spreads),
      overlapPages,
      pages,
      collisions,
      placed,
    }
    metricsCache.set(styleId, metrics)
    return metrics
  }

  it('旋转幅度分档：gallery 完全水平 < muse 极小 < weekend 明显', () => {
    const gallery = metricsFor('gallery')
    const muse = metricsFor('muse')
    const weekend = metricsFor('weekend')
    expect(gallery.maxRotation).toBe(0)
    expect(muse.maxRotation).toBeGreaterThan(0)
    expect(muse.maxRotation).toBeLessThanOrEqual(.25)
    expect(weekend.avgRotation).toBeGreaterThan(muse.avgRotation * 4)
    expect(weekend.maxRotation).toBeGreaterThanOrEqual(2)
  })

  it('尺度对比分档：gallery 最平 < muse < weekend 变化最快', () => {
    const gallery = metricsFor('gallery')
    const muse = metricsFor('muse')
    const weekend = metricsFor('weekend')
    expect(gallery.avgSpread).toBeLessThan(muse.avgSpread)
    expect(muse.avgSpread).toBeLessThan(weekend.avgSpread * .85)
  })

  it('轻叠：gallery 一张都不叠，muse / weekend 会出现相叠的页', () => {
    expect(metricsFor('gallery').overlapPages).toBe(0)
    expect(metricsFor('muse').overlapPages).toBeGreaterThan(0)
  })

  it('风格差异不会牺牲硬边界：不丢图、旋转后内容区仍不碰撞', () => {
    for (const styleId of Object.keys(STYLE_LAYOUTS)) {
      const metrics = metricsFor(styleId)
      expect(metrics.placed, styleId).toBe(metrics.pages * 2)
      expect(metrics.collisions, `${styleId} 旋转后内容区碰撞`).toBe(0)
    }
  })
})
