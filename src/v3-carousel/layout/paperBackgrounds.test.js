import { describe, expect, it } from 'vitest'
import { PAPER_BACKGROUNDS, PAPER_RULES, backgroundFor, backgroundsForStyle, colorStats } from './paperBackgrounds.js'

const STYLE_IDS = ['gallery', 'muse', 'weekend']

describe('V3 背景族：风格内部的一组纸面', () => {
  it('每个风格有 2–4 个背景，id 全局唯一', () => {
    const seen = new Set()
    for (const styleId of STYLE_IDS) {
      const list = backgroundsForStyle(styleId)
      expect(list.length, styleId).toBeGreaterThanOrEqual(2)
      expect(list.length, styleId).toBeLessThanOrEqual(4)
      for (const item of list) {
        expect(seen.has(item.id), `${item.id} 重复`).toBe(false)
        seen.add(item.id)
        expect(item.label, item.id).toBeTruthy()
        expect(item.paper.color, item.id).toMatch(/^#[0-9a-f]{6}$/i)
        expect(item.paper.image, item.id).toBeTruthy()
        expect(item.paper.size, item.id).toBeTruthy()
      }
    }
  })

  it('背景不得抢戏：低饱和、足够亮、自身亮度跨度有上限', () => {
    // 这条规则拦住「高饱和大色块」和「深色背景」，保证照片始终是画面里对比最强的元素。
    // 阈值来自实测调参（validation-log.md §17）：现有色板的饱和度上限 .325、明度下限 .600、
    // 单个背景亮度跨度上限 .407，规则各留了余量。
    for (const styleId of STYLE_IDS) {
      for (const item of backgroundsForStyle(styleId)) {
        const stats = item.colors.map(colorStats)
        for (const [index, stat] of stats.entries()) {
          expect(stat.saturation, `${item.id} ${item.colors[index]} 饱和度`).toBeLessThanOrEqual(PAPER_RULES.maxSaturation)
          expect(stat.lightness, `${item.id} ${item.colors[index]} 明度`).toBeGreaterThanOrEqual(PAPER_RULES.minLightness)
        }
        const luminances = stats.map((stat) => stat.luminance)
        const span = Math.max(...luminances) - Math.min(...luminances)
        expect(span, `${item.id} 自身亮度跨度`).toBeLessThanOrEqual(PAPER_RULES.maxLuminanceSpan)
      }
    }
  })

  it('切换风格时回落到该风格的背景，不会串风格', () => {
    expect(backgroundFor('gallery', 'muse-rose').id).toBe('gallery-warm')
    expect(backgroundFor('weekend', 'weekend-sage').id).toBe('weekend-sage')
    expect(backgroundFor('muse', undefined).id).toBe('muse-cream')
    for (const styleId of STYLE_IDS) {
      for (const item of backgroundsForStyle(styleId)) {
        expect(backgroundFor(styleId, item.id).id, `${styleId} ${item.id}`).toBe(item.id)
      }
    }
  })

  it('三种风格的背景互不重叠（风格轴才不会被背景搅乱）', () => {
    const byStyle = STYLE_IDS.map((styleId) => backgroundsForStyle(styleId).map((item) => item.id))
    const flat = byStyle.flat()
    expect(new Set(flat).size).toBe(flat.length)
    for (const ids of byStyle) {
      for (const id of ids) {
        const owner = STYLE_IDS.filter((styleId) => backgroundsForStyle(styleId).some((item) => item.id === id))
        expect(owner).toHaveLength(1)
      }
    }
  })

  it('色板确实是低饱和的莫兰迪 / 纸色（不是误传的高饱和色）', () => {
    const all = STYLE_IDS.flatMap((styleId) => backgroundsForStyle(styleId))
    const maxSaturation = Math.max(...all.flatMap((item) => item.colors.map((color) => colorStats(color).saturation)))
    const minLightness = Math.min(...all.flatMap((item) => item.colors.map((color) => colorStats(color).lightness)))
    expect(maxSaturation).toBeLessThanOrEqual(PAPER_RULES.maxSaturation)
    expect(minLightness).toBeGreaterThanOrEqual(PAPER_RULES.minLightness)
    expect(PAPER_BACKGROUNDS.weekend.length).toBe(3)
  })
})
