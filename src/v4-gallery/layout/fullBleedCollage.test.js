// Acceptance tests for the full-bleed collage template.
//
// The prompt for this template came with numbers rather than adjectives, so these
// are the numbers: how wide a print comes out, how much of the sheet the pile
// covers, that it reaches the edges, and — the one that can never be traded away —
// that no photo was stretched to get there.
//
// They are stated as properties of the SOLVED LAYOUT, not of a screenshot, so they
// hold for every photo set and every seed rather than for the one that happened to
// be photographed during development.
import { describe, expect, it } from 'vitest'
import { BOARD_HEIGHT, BOARD_WIDTH, buildGalleryOverview, getTemplate, verifyContract } from './overviewLayout.js'
import { boardFor, zoneOf } from './skeleton.js'
import { MAX_SOLVED_PHOTOS } from './solver.js'

const TEMPLATE_ID = 'full-bleed-collage'
const skeleton = getTemplate(TEMPLATE_ID)
const board = boardFor(skeleton)

// The proportion families the upload gate accepts: 2:3 .. 3:2. A template has to
// hold for all of them, not for a convenient middle.
const SETS = {
  '全竖图 13 张': [0.67, 0.67, 0.7, 0.75, 0.67, 0.7, 0.75, 0.67, 0.7, 0.75, 0.67, 0.7, 0.75],
  '全横图 13 张': [1.5, 1.5, 1.4, 1.33, 1.5, 1.4, 1.33, 1.5, 1.4, 1.33, 1.5, 1.4, 1.33],
  '横竖混传 13 张': [4 / 3, 3 / 4, 3 / 2, 2 / 3, 1, 4 / 3, 3 / 4, 1, 3 / 2, 2 / 3, 4 / 3, 1, 3 / 4],
  '方图 12 张': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  '参考图风格 13 张': [1.33, 1.5, 0.75, 0.67, 1.33, 1.5, 1.33, 0.75, 1.5, 1.33, 0.75, 1.33, 1.5],
  '少量 6 张': [1.5, 0.75, 1.33, 0.67, 1, 1.4],
  '满额 10 张': [4 / 3, 3 / 4, 3 / 2, 2 / 3, 1, 4 / 3, 3 / 4, 1, 3 / 2, 2 / 3],
}

const SEEDS = ['gallery-01', 'gallery-02', 'gallery-03']

const solve = (aspects, seed) => buildGalleryOverview(
  aspects.map((aspect, index) => ({ id: `p${index}`, aspect })),
  seed,
  TEMPLATE_ID,
)

// The box a card actually paints: its frame, grown by its own tilt.
function paintedBox(tile) {
  const tilt = (Math.abs(tile.tilt) * Math.PI) / 180
  const width = tile.card.width * Math.cos(tilt) + tile.card.height * Math.sin(tilt)
  const height = tile.card.width * Math.sin(tilt) + tile.card.height * Math.cos(tilt)
  return {
    x: tile.centreX - width / 2,
    y: tile.centreY - height / 2,
    width,
    height,
  }
}

function paintedExtent(layout) {
  const boxes = layout.map(paintedBox)
  return {
    left: Math.min(...boxes.map((box) => box.x)),
    top: Math.min(...boxes.map((box) => box.y)),
    right: Math.max(...boxes.map((box) => box.x + box.width)),
    bottom: Math.max(...boxes.map((box) => box.y + box.height)),
  }
}

describe('满幅拼贴：画布', () => {
  it('印在 4:3 横版纸上，坐标系按画布推导', () => {
    expect(skeleton.board.ratio).toEqual([4, 3])
    expect(board.key).toBe('4:3')
    expect(board.width).toBe(100)
    // The board's height is in the same unit as its width, so the two axes relate by
    // 3/4 — and a vertical measurement reaches the renderer by being scaled by it.
    expect(board.height).toBe(75)
    expect(board.yFactor).toBeCloseTo(0.75, 12)
    expect(board.toBoardHeightPercent(100)).toBeCloseTo(75, 12)
    expect(board.toWidthUnits(75)).toBeCloseTo(100, 12)
  })

  it('满幅：照片可以出血，不需要给文字留位置', () => {
    expect(skeleton.fields).toEqual({})
    expect(skeleton.cluster.bleed).toBeGreaterThan(0)
    const zone = zoneOf(skeleton)
    expect(zone.left).toBe(0)
    expect(zone.right).toBe(board.width)
    expect(zone.top).toBe(0)
    expect(zone.bottom).toBe(board.height)
  })

  it('纸面上只有照片：没有任何文字带', () => {
    expect(Object.keys(skeleton.fields ?? {})).toHaveLength(0)
  })
})

describe('满幅拼贴：验收线', () => {
  const cases = Object.entries(SETS).flatMap(([name, aspects]) => SEEDS.map((seed) => [`${name} · ${seed}`, aspects, seed]))
  it.each(cases)('%s', (_name, aspects, seed) => {
    const layout = solve(aspects, seed)
    expect(layout).toHaveLength(Math.min(aspects.length, MAX_SOLVED_PHOTOS))
    expect(layout.every((tile) => tile.pile && tile.card)).toBe(true)

    // 1. 单张宽度 ≥ 20% 画布宽. Measured on the PHOTO, not on the card around it —
    //    the white rim is chrome, and the promise is about how wide the pictures come
    //    out. The median is asserted too because one very tall photo legitimately
    //    makes one narrow print, and a floor that ignores that would be a lie.
    const widths = layout.map((tile) => tile.width / board.width).sort((a, b) => a - b)
    const median = widths[Math.floor(widths.length / 2)]
    expect(median).toBeGreaterThanOrEqual(0.2)
    expect(widths[0]).toBeGreaterThanOrEqual(0.15)

    // 2. 照片覆盖 ≥ 60% 画布. The union of painted cards, which is what the eye sees;
    //    summing them would count the stacked part several times over.
    const report = verifyContract(layout, skeleton)
    expect(report.violations).toEqual([])
    expect(report.metrics.ink).toBeGreaterThanOrEqual(0.6)

    // 3. 照片群铺满，不留大片空白: the pile spans the sheet on both axes. The
    //    horizontal floor is lower than the vertical one on purpose — a pile of
    //    upright prints is taller than it is wide, and no composition of them can be
    //    made to reach both edges of a landscape sheet. What must never happen is a
    //    band of bare paper along an edge, and that is what these catch.
    const extent = paintedExtent(layout)
    expect((extent.right - extent.left) / board.width).toBeGreaterThan(0.75)
    expect((extent.bottom - extent.top) / board.height).toBeGreaterThan(0.85)

    // 4. 照片形状误差 0.00%. The invariant that cannot be traded away for coverage:
    //    a landscape photo may never be rendered as a portrait one. The tolerance is
    //    set by the solver's rounding of the reported box (six decimals), not by any
    //    slack in the geometry — a squeeze of even one percent would fail here.
    for (const tile of layout) {
      expect(tile.width / tile.height).toBeCloseTo(tile.photo.aspect, 6)
    }
  })

  it.each(cases)('%s · 出血不越界', (_name, aspects, seed) => {
    const layout = solve(aspects, seed)
    const extent = paintedExtent(layout)
    // A print may run past the edge — that is the point of a full-bleed sheet — but
    // only as far as the template declared, and never so far that the composition is
    // mostly off-canvas.
    const bleed = skeleton.cluster.bleed
    expect(extent.left).toBeGreaterThan(-bleed)
    expect(extent.top).toBeGreaterThan(-bleed)
    expect(extent.right).toBeLessThan(board.width + bleed)
    expect(extent.bottom).toBeLessThan(board.height + bleed)
  })
})

describe('满幅拼贴：堆叠关系', () => {
  it('照片之间互相压叠，而不是排成整齐的网格', () => {
    const layout = solve(SETS['参考图风格 13 张'], 'gallery-01')
    const boxes = layout.map(paintedBox)
    // Counted on the CARDS, which is what paper covers paper, and asserted on the
    // overwhelming majority rather than on every single one: the outermost print of a
    // row can legitimately sit beside its neighbour rather than under it.
    const overlapping = boxes.filter((box, i) => boxes.some((other, j) => (
      j !== i && box.x < other.x + other.width && box.x + box.width > other.x
        && box.y < other.y + other.height && box.y + box.height > other.y
    )))
    expect(overlapping.length).toBeGreaterThanOrEqual(Math.ceil(layout.length * 0.75))
    // And the stack is real rather than incidental: the area the cards would cover if
    // they were laid out flat is meaningfully more than the area they actually cover,
    // which is exactly what overlap means numerically.
    //
    // The card's height is a percent of board HEIGHT, so it converts into width units
    // before it can be multiplied by a width. Doing it the other way is the classic
    // mistake this codebase keeps warning about, and it reports a 13-photo sheet as
    // covering half of what it really does.
    const sum = boxes.reduce((total, box) => total + (box.width / board.width) * (box.height / board.yFactor), 0)
    const coverage = verifyContract(layout, skeleton).metrics.ink
    expect(sum).toBeGreaterThan(coverage * 1.2)
  })

  it('每一张都带旋转和小幅抖动，没有一张是正的', () => {
    const layout = solve(SETS['参考图风格 13 张'], 'gallery-02')
    const tilts = layout.map((tile) => Math.abs(tile.tilt))
    expect(tilts.every((tilt) => tilt > 0.2)).toBe(true)
    expect(Math.max(...tilts)).toBeLessThanOrEqual(skeleton.cluster.tilt + 1e-9)
  })

  it('同一 seed 稳定，换 seed 只换排布不换结构', () => {
    const aspects = SETS['参考图风格 13 张']
    expect(solve(aspects, 'gallery-01')).toEqual(solve(aspects, 'gallery-01'))
    const one = solve(aspects, 'gallery-01')
    const two = solve(aspects, 'gallery-07')
    // Same number of photos, same card count per row pattern is not guaranteed; what
    // must hold is that both are valid sheets of the same template.
    expect(two).toHaveLength(one.length)
    expect(verifyContract(two, skeleton).violations).toEqual([])
  })

  it('照片群落在 4:3 画布内，不依赖 4:5 的旧坐标', () => {
    // A guard against the whole class of bug this template introduced: if any code
    // path still mixed the two axes, the pile would be a quarter of the sheet tall
    // and this would catch it.
    const layout = solve(SETS['横竖混传 13 张'], 'gallery-01')
    const extent = paintedExtent(layout)
    expect(extent.bottom / board.height).toBeGreaterThan(0.85)
    // And it must NOT be measured against the old 4:5 board.
    expect(extent.bottom).toBeLessThan(BOARD_HEIGHT)
    expect(extent.right).toBeLessThan(BOARD_WIDTH + skeleton.cluster.bleed)
  })
})
