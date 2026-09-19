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

  it('颜色对比按面积分配：大面积只允许纸色，小面积可以强色', () => {
    // 参考图的做法是「浅底 + 小块强色」，不是整幅高饱和。判据用彩度（max−min 通道差）。
    for (const styleId of STYLE_IDS) {
      for (const item of backgroundsForStyle(styleId)) {
        for (const color of item.colors) {
          const stats = colorStats(color)
          expect(stats.chroma, `${item.id} ${color} 大面积彩度`).toBeLessThanOrEqual(PAPER_RULES.large.maxChroma)
          expect(stats.lightness, `${item.id} ${color} 大面积明度`).toBeGreaterThanOrEqual(PAPER_RULES.large.minLightness)
        }
        for (const color of item.accents) {
          const stats = colorStats(color)
          expect(stats.chroma, `${item.id} ${color} 小面积彩度`).toBeLessThanOrEqual(PAPER_RULES.small.maxChroma)
          expect(stats.lightness, `${item.id} ${color} 小面积明度`).toBeGreaterThanOrEqual(PAPER_RULES.small.minLightness)
        }
      }
    }
  })

  it('规则真的能拦住高饱和与深色：反例必须被拒', () => {
    // 这条测试是防「规则被改成橡皮图章」：给几个典型反例，它们必须超出边界。
    const saturated = ['#c0392b', '#1e6fd9', '#e8b900', '#7b2ff7']
    for (const color of saturated) {
      expect(colorStats(color).chroma, color).toBeGreaterThan(PAPER_RULES.large.maxChroma)
    }
    const dark = ['#333333', '#2b2b2b', '#4a4a4a']
    for (const color of dark) {
      expect(colorStats(color).lightness, color).toBeLessThan(PAPER_RULES.large.minLightness)
    }
  })

  it('颗粒必须无缝可平铺、且淡到不会把画面弄脏', () => {
    for (const styleId of STYLE_IDS) {
      for (const item of backgroundsForStyle(styleId)) {
        if (!item.paper.image.includes('feTurbulence')) continue
        // stitchTiles='stitch' 是噪声瓦片无缝的前提 —— 逐页导出靠平移取景，有接缝就会露出来。
        expect(item.paper.image, item.id).toContain('stitchTiles')
        // data-URI 里的 SVG 参数被 URL 编码过（= 会变成 %3D），所以正则两种写法都要认。
        const opacities = [...item.paper.image.matchAll(/opacity(?:%3D|=)'([\d.]+)'/g)].map((match) => Number(match[1]))
        expect(opacities.length, item.id).toBeGreaterThan(0)
        for (const opacity of opacities) {
          expect(opacity, `${item.id} 颗粒不透明度`).toBeLessThanOrEqual(PAPER_RULES.maxGrainOpacity)
        }
        // 颗粒层与混合模式必须一一对应，否则 blend-mode 会错位到别的层上
        if (item.paper.blend) {
          expect(item.paper.blend.split(', ').length, `${item.id} blend 层数应等于背景层数`).toBe(item.paper.size.split(', ').length)
        }
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
    for (const id of flat) {
      const owner = STYLE_IDS.filter((styleId) => backgroundsForStyle(styleId).some((item) => item.id === id))
      expect(owner).toHaveLength(1)
    }
  })

  it('每个风格至少有一个「有纸感」的背景（不只是纯色或网格）', () => {
    for (const styleId of STYLE_IDS) {
      const list = backgroundsForStyle(styleId)
      // 纸张材质方向：底色 + 颗粒（噪声）是纸感的底线，每个风格都要有。
      expect(list.some((item) => item.paper.image.includes('feTurbulence')), styleId).toBe(true)
    }
    expect(PAPER_BACKGROUNDS.gallery.some((item) => item.id === 'gallery-aged')).toBe(true)
  })
})
