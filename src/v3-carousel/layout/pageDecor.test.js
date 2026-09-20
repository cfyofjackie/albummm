import { describe, expect, it } from 'vitest'
import { FOOTER_LABEL, LABEL_HEIGHT, footerFor, labelBox, labelPagesFor, labelTextFor, pad2 } from './pageDecor.js'
import { DEFAULT_FORMAT, STYLE_LAYOUTS, TAPE_STYLES, innerBox, materialOf, planSmartStory, tapeRect } from './carouselPlacement.js'

const DIMS = [[2400, 1800], [1200, 1600], [3000, 1200], [1400, 1400], [1200, 3000], [1600, 1200], [1200, 1600], [4000, 1500], [1600, 2000], [2000, 2000]]
const photosOf = (count) => Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `p${index}.jpg`, width: DIMS[index % DIMS.length][0], height: DIMS[index % DIMS.length][1] }))
const SEEDS = Array.from({ length: 8 }, (_, index) => index * 137 + 11)

const intersectionOf = (a, b) => {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return w * h
}

describe('V3 排版层装饰：页脚条 + micro-label', () => {
  it('页脚：序号补零、总页数补零、标签转大写', () => {
    expect(footerFor(0, 5)).toEqual({ page: '01', total: '05', label: FOOTER_LABEL })
    expect(footerFor(11, 24).page).toBe('12')
    expect(footerFor(0, 5, 'vol. 02').label).toBe('VOL. 02')
    expect(pad2(3)).toBe('03')
  })

  it('micro-label 页数：一组 2–4 处、首尾优先、按页数均分', () => {
    expect(labelPagesFor(0)).toEqual([])
    expect(labelPagesFor(2)).toEqual([0, 1])
    // 5 页 → 第 1、3、5 页（首尾 + 中间）
    expect(labelPagesFor(5)).toEqual([0, 2, 4])
    // 更多页时仍然是 3 处，且首尾必在其中
    for (const pageCount of [6, 8, 10, 13]) {
      const pages = labelPagesFor(pageCount)
      expect(pages.length, `页数 ${pageCount}`).toBeLessThanOrEqual(3)
      expect(pages[0], `页数 ${pageCount}`).toBe(0)
      expect(pages[pages.length - 1], `页数 ${pageCount}`).toBe(pageCount - 1)
      expect(new Set(pages).size, `页数 ${pageCount} 有重复`).toBe(pages.length)
    }
  })

  it('micro-label 文字用照片的真实序号，不是编造的内容', () => {
    expect(labelTextFor(0)).toBe('FRAME 01')
    expect(labelTextFor(9)).toBe('FRAME 10')
  })

  it('micro-label 贴在卡片下方，矩形在页面内', () => {
    const card = { x: .2, y: .3, w: .4, h: .4 }
    const box = labelBox(card)
    expect(box.y).toBeGreaterThan(card.y + card.h)
    expect(box.x).toBe(card.x)
    expect(box.h).toBe(LABEL_HEIGHT)
    expect(box.w).toBeLessThanOrEqual(card.w)
  })

  it('一组作品里 label 数量正确，且同一页内 label 底下不会有别的照片内容', () => {
    let labeled = 0
    for (const styleId of Object.keys(STYLE_LAYOUTS)) {
      for (const count of [6, 10, 13, 24]) {
        for (const seed of SEEDS) {
          const story = planSmartStory(photosOf(count), seed, STYLE_LAYOUTS[styleId], DEFAULT_FORMAT, materialOf({}))
          const expected = labelPagesFor(story.frames.length)
          const labelFrames = story.frames.map((frame, index) => (frame.placed.some((card) => card.label) ? index : -1)).filter((index) => index >= 0)
          // 计划贴 label 的页，若该页成功放下照片就必须有 label（顺延的补充页不在计划内）
          expect(labelFrames, `${styleId} count=${count} seed=${seed}`).toEqual(expected.filter((index) => story.frames[index]?.placed.length))
          for (const frame of story.frames) {
            for (const card of frame.placed) {
              if (!card.label) continue
              labeled += 1
              expect(card.labelText, `${styleId} seed=${seed}`).toMatch(/^FRAME \d{2}$/)
              const box = labelBox(card)
              // label 必须留在本页之内（每页是各自的画布，跨页不算碰撞）
              expect(box.y + box.h, `${styleId} seed=${seed} label 跑出页面`).toBeLessThanOrEqual(1)
              // 同一页内：label 底下不能有别张照片的内容
              for (const other of frame.placed) {
                if (other.photo.id === card.photo.id) continue
                expect(intersectionOf(box, innerBox(other, DEFAULT_FORMAT, materialOf({}))), `label 压到了 ${other.photo.name}`).toBeLessThanOrEqual(1e-9)
              }
            }
          }
        }
      }
    }
    expect(labeled).toBeGreaterThan(0)
  })

  it('同一张卡片上 label 在下方、胶带在上方，两者不可能重叠', () => {
    for (const seed of SEEDS) {
      const story = planSmartStory(photosOf(10), seed, STYLE_LAYOUTS.muse, DEFAULT_FORMAT, materialOf({ tape: TAPE_STYLES.washi }))
      for (const frame of story.frames) {
        for (const card of frame.placed) {
          if (!card.label) continue
          const tape = tapeRect({ ...card, tape: true }, DEFAULT_FORMAT, materialOf({ tape: TAPE_STYLES.washi }))
          if (tape) expect(intersectionOf(labelBox(card), tape), `seed=${seed}`).toBe(0)
        }
      }
    }
  })
})
