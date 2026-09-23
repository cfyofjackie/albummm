// Tests for the template layer itself: the skeleton schema, the capability
// registry, and the contract checker.
//
// These are the tests that keep "a new template is just data" true. A skeleton is
// the one place a typo can silently produce a wrong layout, so it is validated
// loudly; and the contract is what makes "the result still looks like the
// template" a number instead of an opinion.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEMPLATE_ID,
  MAX_RATIO,
  MIN_RATIO,
  RATIO_HINT,
  RECOMMENDED_FORMATS,
  allTemplates,
  buildGalleryOverview,
  describeSuggestion,
  getTemplate,
  isAcceptedRatio,
  partitionByRatio,
  registeredCapabilities,
  validateAllTemplates,
  validateSkeleton,
  verifyContract,
} from './overviewLayout.js'
import { renderedAspect } from './contract.js'
import { zoneOf } from './skeleton.js'
import { solveTemplateWith } from './overviewLayout.js'

const photos = (aspects) => aspects.map((aspect, index) => ({ id: `p${index}`, aspect }))

describe('V4 模板层：骨架、能力、契约', () => {
  it('注册表里的每个模板都是合法骨架', () => {
    expect(validateAllTemplates()).toEqual([])
    expect(allTemplates().length).toBeGreaterThan(0)
    expect(getTemplate(DEFAULT_TEMPLATE_ID).id).toBe(DEFAULT_TEMPLATE_ID)
  })

  it('未知模板会显式报错，而不是悄悄回退', () => {
    expect(() => getTemplate('no-such-template')).toThrow(/未知模板/)
  })

  it.each([
    ['缺少 id', { ...getTemplate(DEFAULT_TEMPLATE_ID), id: undefined }],
    ['缺少 board', (() => { const t = { ...getTemplate(DEFAULT_TEMPLATE_ID) }; delete t.board; return t })()],
    ['不支持的画布比例', { ...getTemplate(DEFAULT_TEMPLATE_ID), board: { ratio: [16, 9] } }],
    ['pipeline 为空', { ...getTemplate(DEFAULT_TEMPLATE_ID), pipeline: [] }],
    ['zone 横向越界', {
      ...getTemplate(DEFAULT_TEMPLATE_ID),
      cluster: { ...getTemplate(DEFAULT_TEMPLATE_ID).cluster, zone: { left: 10, right: 200, top: 15, bottom: 49.5 } },
    }],
    ['gutter 区间无效', {
      ...getTemplate(DEFAULT_TEMPLATE_ID),
      cluster: { ...getTemplate(DEFAULT_TEMPLATE_ID).cluster, gutter: [2, 1] },
    }],
    ['unitScale.rows 非正', {
      ...getTemplate(DEFAULT_TEMPLATE_ID),
      cluster: { ...getTemplate(DEFAULT_TEMPLATE_ID).cluster, unitScale: { rows: 0, base: 8, growth: 0.5 } },
    }],
  ])('骨架校验能抓住「%s」', (_, broken) => {
    expect(validateSkeleton(broken).length).toBeGreaterThan(0)
  })

  it('模板卡提示由骨架推导，且写明建议张数与方向', () => {
    const hint = describeSuggestion(getTemplate(DEFAULT_TEMPLATE_ID))
    const [min, max] = getTemplate(DEFAULT_TEMPLATE_ID).suggest.photos
    expect(hint).toContain(String(min))
    expect(hint).toContain(String(max))
    expect(hint).toMatch(/横图|竖图/)
  })

  it('能力注册表非空，且模板只引用已注册的能力', () => {
    const available = registeredCapabilities()
    expect(available.length).toBeGreaterThan(0)
    for (const skeleton of allTemplates()) {
      for (const name of skeleton.pipeline) {
        expect(available).toContain(name)
      }
    }
  })

  it('按 id 求解与直接传骨架求解结果一致', () => {
    const list = photos([1.5, 0.67, 1.4, 0.75, 1.33])
    expect(buildGalleryOverview(list, 'gallery-01'))
      .toEqual(solveTemplateWith(getTemplate(DEFAULT_TEMPLATE_ID), list, 'gallery-01'))
  })

  it('契约检查器能抓出被压扁的照片', () => {
    const layout = buildGalleryOverview(photos([1.5, 0.67, 1.4]), 'gallery-01')
    const squeezed = layout.map((tile, index) => (index === 0 ? { ...tile, height: tile.height * 0.5 } : tile))
    const report = verifyContract(squeezed, getTemplate(DEFAULT_TEMPLATE_ID))
    expect(report.ok).toBe(false)
    expect(report.violations.join(' ')).toMatch(/压扁/)
  })

  it('契约检查器能抓出文字带被照片压住', () => {
    const skeleton = getTemplate(DEFAULT_TEMPLATE_ID)
    // A block pushed far enough down must collide with the caption band.
    const layout = buildGalleryOverview(photos([1.5, 0.67, 1.4]), 'gallery-01')
    const pushed = layout.map((tile) => ({ ...tile, y: tile.y + 30 }))
    const report = verifyContract(pushed, skeleton)
    expect(report.ok).toBe(false)
    expect(report.violations.join(' ')).toMatch(/文字带/)
  })

  it('契约检查器能抓出重叠与越界', () => {
    const skeleton = getTemplate(DEFAULT_TEMPLATE_ID)
    const layout = buildGalleryOverview(photos([1.5, 0.67, 1.4, 1.6]), 'gallery-01')
    const stacked = layout.map((tile, index) => (index === 0 ? { ...tile, x: layout[1].x, y: layout[1].y } : tile))
    expect(verifyContract(stacked, skeleton).violations.join(' ')).toMatch(/重叠/)
    const escaped = layout.map((tile, index) => (index === 0 ? { ...tile, x: 99 } : tile))
    expect(verifyContract(escaped, skeleton).violations.join(' ')).toMatch(/超出画布/)
  })

  it('契约报告里的比例一律按真实渲染比例给出', () => {
    const layout = buildGalleryOverview(photos([1.5, 0.67, 1.4, 0.75]), 'gallery-01')
    for (const tile of layout) {
      // The photo's own ratio is what the tile claims; the report must agree.
      expect(renderedAspect(tile)).toBeCloseTo(Math.max(0.5, Math.min(1.85, tile.photo.aspect)), 3)
    }
  })

  it('保留区随骨架给出，且落在画布内', () => {
    for (const skeleton of allTemplates()) {
      const zone = zoneOf(skeleton)
      expect(zone.width).toBeGreaterThan(0)
      expect(zone.height).toBeGreaterThan(0)
      expect(zone.left).toBeGreaterThanOrEqual(0)
      expect(zone.right).toBeLessThanOrEqual(100)
    }
  })
})

describe('V4 可上传比例：光圈由常规画幅推出', () => {
  it('建议名单里的每一种画幅都在允许范围内', () => {
    expect(RECOMMENDED_FORMATS.length).toBeGreaterThan(0)
    for (const format of RECOMMENDED_FORMATS) {
      expect(isAcceptedRatio(format.ratio)).toBe(true)
    }
  })

  it.each([
    ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4],
    ['3:2', 3 / 2], ['2:3', 2 / 3], ['6:9（与 2:3 同比例）', 6 / 9],
  ])('%s 允许上传', (_, ratio) => {
    expect(isAcceptedRatio(ratio)).toBe(true)
  })

  it.each([
    ['16:9', 16 / 9], ['9:16', 9 / 16],
    ['超长竖 1:2', 0.5], ['超长竖 1:3', 1 / 3],
    ['超宽 2:1', 2], ['超宽 21:9', 21 / 9], ['全景 3:1', 3],
  ])('%s 被拒绝', (_, ratio) => {
    expect(isAcceptedRatio(ratio)).toBe(false)
  })

  it('光圈上下沿正好卡在 2:3 与 3:2', () => {
    expect(MIN_RATIO).toBeCloseTo(2 / 3, 10)
    expect(MAX_RATIO).toBeCloseTo(3 / 2, 10)
  })

  it('被拒绝的屏幕比例在提示文案里被点名', () => {
    // 16:9 / 9:16 are what people upload without thinking, so the copy names them.
    expect(RATIO_HINT).toContain('16:9')
    expect(RATIO_HINT).toContain('9:16')
    for (const format of RECOMMENDED_FORMATS) {
      expect(RATIO_HINT).toContain(format.label)
    }
  })

  it('一批照片按比例分成可用与不可用两组，并保持顺序', () => {
    const batch = photos([1, 4 / 3, 16 / 9, 3 / 4, 0.4, 2 / 3])
    const { accepted, rejected } = partitionByRatio(batch)
    expect(accepted.map((p) => p.id)).toEqual(['p0', 'p1', 'p3', 'p5'])
    expect(rejected.map((p) => p.id)).toEqual(['p2', 'p4'])
  })

  it('在允许范围内的照片不会触发裁切标记', () => {
    // The gate and the solver share one band, so nothing accepted should be
    // reported as needing a crop.
    const layout = buildGalleryOverview(photos([1, 4 / 3, 3 / 4, 2 / 3, 3 / 2, 1]), 'gallery-01')
    expect(layout.filter((tile) => tile.crop)).toHaveLength(0)
  })
})
