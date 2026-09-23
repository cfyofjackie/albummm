// Layout contract: what must hold no matter which template produced a layout.
//
// Without this, "the result still looks like the template" is a matter of opinion
// and every change has to be judged by eye. With it, a solve emits a report that
// can go into tests and onto the canvas: the invariants below are shared by every
// template and cannot be switched off, while the template's own declarative ranges
// are checked on top.

import { overlaps } from './geometry.js'
import { boardFor, zoneOf } from './skeleton.js'

// A tile's real aspect ratio, in one place so the convention cannot drift.
//
// Corner-anchored families report `width` in percent of board width and `height`
// in percent of board HEIGHT, so the height needs converting into width units
// (multiplying by the board's own yFactor) before the two can be divided. The
// factor is the board's, not a constant: on the original 4:5 sheet it is 0.8, on
// the 4:3 landscape sheet it is 4/3.
//
// Rotated families (instant prints, stacked collages) report both dimensions in
// the SAME physical space — fractions of board width — because the renderer
// divides them to get a unitless CSS `aspect-ratio`. Applying the board-height
// conversion to those would report every tilted print as squeezed, which is
// exactly the false alarm this branch removes.
export const renderedAspect = (tile, board = boardFor(null)) => (
  typeof tile.centreX === 'number'
    ? tile.width / tile.height
    : tile.width / (tile.height / board.yFactor)
)

/**
 * The box a tile actually paints, in the physical space the report measures in —
 * width units on both axes.
 *
 * For a centre-anchored, rotated tile that is its frame grown by the tilt, because
 * the browser paints the turned corners. `card` is the printed frame where a family
 * has one: a print's paper is opaque, so the paper is what lands on the sheet, and
 * measuring the picture inside it instead lets an outer print cross the edge while
 * the check reports everything inside.
 *
 * Everything that measures area or reach goes through this. The one thing it must
 * never do is mix the axes: the returned `width` and `height` are in the SAME unit,
 * so `width * height` is a real area and `width / height` is a real shape.
 */
export function frameBox(tile, board = boardFor(null)) {
  const scale = board.yFactor
  if (typeof tile.centreX !== 'number') {
    return { x: tile.x, y: tile.y / scale, width: tile.width, height: tile.height / scale }
  }
  const width = tile.card?.width ?? tile.width
  const height = tile.card?.height ?? tile.height
  const tilt = (Math.abs(tile.tilt || 0) * Math.PI) / 180
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  // Width is ALREADY in width units; only the vertical dimension needs converting, and
  // it needs converting before it is combined with a width — a rotated box mixes the
  // two. Scaling both is the subtler version of the same mistake: it looks like a
  // consistent "convert everything" and it silently shrinks the horizontal span by the
  // board's ratio, which then reads as a pile that fits when it does not.
  const boxHeight = (width * sin + height * cos) * scale
  const boxWidth = width * cos + height * sin
  return {
    x: tile.centreX - boxWidth / 2,
    y: tile.centreY - boxHeight / 2 / scale,
    width: boxWidth,
    height: boxHeight,
  }
}

// Sampled at about the resolution the hollow detector uses: fine enough that two
// candidates a percent apart are ordered correctly, coarse enough to run inside a
// sweep of a few thousand blocks.
const COVERAGE_STEP = 0.5

/**
 * How much of the sheet the photos actually cover: the UNION of their painted boxes,
 * as a share of the board.
 *
 * The union, not the sum. Adding the boxes up counts the stacked part two or three
 * times over, which reports a set of prints as covering 160% of a sheet — and for a
 * family whose whole point is that the prints overlap, a metric that rewards overlap
 * is worse than no metric at all. Two prints covering the same square inch are one
 * square inch of ink.
 */
export function paintedCoverage(tiles, board = boardFor(null)) {
  if (!tiles.length) return 0
  const nx = Math.ceil(board.width / COVERAGE_STEP)
  const ny = Math.ceil(board.height / COVERAGE_STEP)
  const cells = new Uint8Array(nx * ny)
  for (const tile of tiles) {
    const box = frameBox(tile, board)
    const x0 = Math.max(0, box.x)
    const y0 = Math.max(0, box.y)
    const x1 = Math.min(board.width, box.x + box.width)
    const y1 = Math.min(board.height, box.y + box.height)
    if (!(x1 > x0) || !(y1 > y0)) continue
    const cx0 = Math.max(0, Math.floor(x0 / COVERAGE_STEP))
    const cy0 = Math.max(0, Math.floor(y0 / COVERAGE_STEP))
    const cx1 = Math.min(nx - 1, Math.ceil(x1 / COVERAGE_STEP) - 1)
    const cy1 = Math.min(ny - 1, Math.ceil(y1 / COVERAGE_STEP) - 1)
    for (let iy = cy0; iy <= cy1; iy += 1) {
      for (let ix = cx0; ix <= cx1; ix += 1) cells[iy * nx + ix] = 1
    }
  }
  let covered = 0
  for (let i = 0; i < cells.length; i += 1) covered += cells[i]
  return (covered * COVERAGE_STEP * COVERAGE_STEP) / (board.width * board.height)
}

// A tile's axis-aligned box in the space the CHECKS use: board-width percent across,
// board-height percent down. That is the space `tile.y` / `tile.height` and the
// template's text bands are written in, so the bounds and collision checks have to
// work there. `frameBox` is the same box in width units on both axes, which is the
// space areas and shares belong in; this converts between the two at the one place
// where the full board ratio is known.
export function boundingBoxOf(tile, board = boardFor(null)) {
  const box = frameBox(tile, board)
  return {
    x: box.x,
    y: box.y * board.yFactor,
    width: box.width,
    height: box.height * board.yFactor,
  }
}

// A hole is empty area *fully enclosed* by tiles. Space that reaches the edge of
// the block's bounding box is not a hole — it is a step in the silhouette, which
// the reference has plenty of. Without this distinction the detector flags the
// ordinary staircase along the bottom edge of a skyline-packed block, which is
// expected and fine; what must never happen is an island of empty canvas with
// photos on all four sides.
//
// Exported because the solver scores with the same predicate: one definition of
// "hole" serves both the optimiser and the checker.
export function hasEnclosedVoid(tiles) {
  const left = Math.min(...tiles.map((tile) => tile.x))
  const top = Math.min(...tiles.map((tile) => tile.y))
  const right = Math.max(...tiles.map((tile) => tile.x + tile.width))
  const bottom = Math.max(...tiles.map((tile) => tile.y + tile.height))
  const step = Math.max(0.5, (right - left) / 60)
  const nx = Math.ceil((right - left) / step) + 1
  const ny = Math.ceil((bottom - top) / step) + 1
  const free = new Uint8Array(nx * ny)

  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const px = left + (ix + 0.5) * step
      const py = top + (iy + 0.5) * step
      const inside = tiles.some((tile) => px >= tile.x && px <= tile.x + tile.width && py >= tile.y && py <= tile.y + tile.height)
      free[iy * nx + ix] = inside ? 0 : 1
    }
  }

  const seen = new Uint8Array(nx * ny)
  const stack = []
  // Seed the flood from every free cell on the bounding box border, so anything
  // reachable from outside is marked as "outside" rather than as a hole.
  for (let ix = 0; ix < nx; ix += 1) {
    for (const iy of [0, ny - 1]) {
      const index = iy * nx + ix
      if (free[index] && !seen[index]) {
        seen[index] = 1
        stack.push(index)
      }
    }
  }
  for (let iy = 0; iy < ny; iy += 1) {
    for (const ix of [0, nx - 1]) {
      const index = iy * nx + ix
      if (free[index] && !seen[index]) {
        seen[index] = 1
        stack.push(index)
      }
    }
  }

  while (stack.length) {
    const index = stack.pop()
    const ix = index % nx
    const iy = (index - ix) / nx
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const jx = ix + dx
      const jy = iy + dy
      if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue
      const next = jy * nx + jx
      if (seen[next] || !free[next]) continue
      seen[next] = 1
      stack.push(next)
    }
  }

  for (let i = 0; i < free.length; i += 1) {
    if (free[i] && !seen[i]) return true
  }
  return false
}

// Two tiles touch if their edge gap is within the gutter they were placed with.
// Used for the connectivity check, which is what "one block, not a scatter" means
// numerically.
function connected(tiles, tolerance) {
  if (tiles.length <= 1) return true
  const linked = new Set([tiles[0].id ?? 0])
  const key = (tile, index) => tile.id ?? index
  let grew = true
  while (grew && linked.size < tiles.length) {
    grew = false
    tiles.forEach((tile, index) => {
      if (linked.has(key(tile, index))) return
      const joined = tiles.some((anchor, anchorIndex) => {
        if (!linked.has(key(anchor, anchorIndex))) return false
        const xGap = Math.max(anchor.x - (tile.x + tile.width), tile.x - (anchor.x + anchor.width), 0)
        const yGap = Math.max(anchor.y - (tile.y + tile.height), tile.y - (anchor.y + anchor.height), 0)
        return xGap <= tolerance && yGap <= tolerance
      })
      if (joined) {
        linked.add(key(tile, index))
        grew = true
      }
    })
  }
  return linked.size === tiles.length
}

/**
 * Check a solved layout against the shared invariants plus the template's own
 * declared ranges.
 *
 * @returns a report: `ok`, a list of violations, a list of notes, and `fidelity`
 *          (1 when nothing was violated, dropping as requirements are missed).
 */
export function verifyContract(layout, skeleton) {
  const violations = []
  const notes = []
  const board = boardFor(skeleton)
  const zones = zoneOf(skeleton)
  // Overlap is a design element in some families (instant prints are meant to
  // cover one another slightly) and an error in others (a tiled contact sheet must
  // never stack). The template declares which, so the invariants below stay honest
  // instead of being quietly skipped.
  const overlapPolicy = skeleton.contract?.overlap ?? { allowed: false }
  // A sheet the photos are allowed to run off. Zero for every tiled template; the
  // full-bleed collage declares it, because a pile of prints whose outer cards stop
  // politely inside the paper is exactly what the reference is not.
  const bleed = skeleton.cluster?.bleed ?? 0

  if (!layout.length) {
    return { ok: false, violations: ['布局为空'], notes, fidelity: 0 }
  }

  // 1. No overlap, unless the template allows it. When allowed, the amount was
  //    already capped by the solver that chose the block, so there is nothing left
  //    to assert here beyond the cap having held.
  if (!overlapPolicy.allowed) {
    layout.forEach((tile, index) => {
      layout.slice(index + 1).forEach((other) => {
        if (overlaps(tile, other)) violations.push(`照片 ${tile.id} 与 ${other.id} 重叠`)
      })
    })
  }

  // 2. Inside the board. A rotated frame is inside when its rotated box is. The
  //    bleed a template declares widens the board for this check and nothing else:
  //    a full-bleed collage is painted onto paper that continues past the frame,
  //    so its outer prints may legally cross the edge.
  for (const tile of layout) {
    const box = boundingBoxOf(tile)
    if (box.x < -bleed - 0.001 || box.y < -bleed - 0.001
      || box.x + box.width > board.width + bleed + 0.001
      || box.y + box.height > board.height + bleed + 0.001) {
      violations.push(`照片 ${tile.id} 超出画布`)
    }
  }

  // 3. Real ratio preserved. This is the single most important invariant: a tile
  //    whose width over its physical height is not the photo's ratio has been
  //    squeezed, which is the one thing the layout must never do.
  //
  //    Width is percent of board width and height is percent of board height, so
  //    the height is converted before comparing. `renderedAspect` is the one place
  //    that conversion lives for checking.
  //
  //    A photo whose original ratio sits outside the usable band is deliberately
  //    folded in and marked `crop`, so the comparison uses the ratio the solver
  //    committed to — `originalAspect` — not the raw photo ratio. Comparing
  //    against the raw ratio would flag every intentional crop as a squeeze.
  for (const tile of layout) {
    const natural = tile.originalAspect
      ?? tile.photo?.aspect
      ?? (tile.photo ? tile.photo.width / tile.photo.height : null)
    if (!natural) continue
    const committed = Math.max(0.5, Math.min(1.85, natural))
    const rendered = renderedAspect(tile, board)
    // A rotated frame's axis-aligned box is legitimately not its ratio — the box
    // grows by sin(tilt) on both axes. Measuring the box would flag every tilted
    // print as squeezed, so the tolerance widens with the tilt.
    const tilt = Math.abs(tile.tilt || 0)
    const tolerance = tilt > 0.01 ? 0.02 + Math.sin((tilt * Math.PI) / 180) * 2 : 0.02
    if (Math.abs(rendered - committed) > tolerance) {
      violations.push(`照片 ${tile.id} 比例被压扁（${rendered.toFixed(3)} vs ${committed.toFixed(3)}）`)
    }
  }

  // 4. One connected block — for the families that tile. Instant prints are meant
  //    to sit apart with background showing between them, so requiring a single
  //    connected mass would contradict the design.
  if (!overlapPolicy.allowed) {
    const gutter = layout[0]?.gutter || 1.5
    if (!connected(layout, Math.max(gutter * 2, 4))) violations.push('照片块不连通')
    // 5. No hole inside the block.
    if (hasEnclosedVoid(layout)) violations.push('照片块内部有空洞')
  }

  // 6. One tile may not dominate the block.
  const areas = layout.map((tile) => tile.width * tile.height)
  const total = areas.reduce((sum, area) => sum + area, 0)
  const heroShare = Math.max(...areas) / total
  if (heroShare > 0.5) violations.push(`单张照片占整块 ${(heroShare * 100).toFixed(0)}%，超过一半`)

  // 7. The block has to actually claim the room the template reserved, or the
  //    composition collapses into a small ornament on a large sheet. Measured in
  //    width units on both axes — `frameBox` — so that an area is an area and a
  //    share of the board is comparable between the two axes.
  const boxes = layout.map((tile) => frameBox(tile, board))
  const minX = Math.min(...boxes.map((box) => box.x))
  const maxX = Math.max(...boxes.map((box) => box.x + box.width))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxY = Math.max(...boxes.map((box) => box.y + box.height))
  const blockWidthShare = (maxX - minX) / board.width
  const blockHeightShare = (maxY - minY) / board.height

  const range = skeleton.contract?.cluster
  if (range?.width) {
    if (blockWidthShare < range.width[0] - 0.02) notes.push(`照片块只占画布宽 ${(blockWidthShare * 100).toFixed(1)}%，低于模板期望的 ${(range.width[0] * 100).toFixed(0)}%`)
  }
  if (range?.height) {
    if (blockHeightShare < range.height[0] - 0.02) notes.push(`照片块只占画布高 ${(blockHeightShare * 100).toFixed(1)}%，低于模板期望的 ${(range.height[0] * 100).toFixed(0)}%`)
  }

  // 8. The text bands the template reserved must stay clear of the photos, or the
  //    caption lands on top of an image. Bands are percentages of the board box,
  //    exactly like the solved `y` / `height`, so no conversion is needed.
  const fields = skeleton.fields ?? {}
  for (const [name, field] of Object.entries(fields)) {
    if (!field.band) continue
    // Bands are given the way the skeleton gives its zone: in width units by default,
    // or in percent of board height for a skeleton that styles its own typography.
    const base = skeleton.cluster?.verticalAxis === 'height' ? 1 : board.yFactor
    const band = {
      left: field.band.left,
      right: field.band.right,
      top: field.band.top * base,
      bottom: field.band.bottom * base,
    }
    for (const box of boxes) {
      const overlapX = box.x < band.right && box.x + box.width > band.left
      const overlapY = box.y < band.bottom && box.y + box.height > band.top
      if (overlapX && overlapY) violations.push(`${name} 文字带与照片重叠`)
    }
  }

  // The scored terms are the same ones the solver optimises; reporting them makes a
  // regression visible without re-deriving anything. `boxes` is already in width
  // units on both axes, so these are real areas and real shares with no conversion
  // left to get wrong.
  const blockWidth = maxX - minX
  const blockHeight = maxY - minY
  const blockArea = (blockWidth / board.width) * (blockHeight / board.width)
  const metrics = {
    columns: layout[0]?.cols ?? 0,
    // Two different questions, and both worth reporting: how densely the block FILLS
    // its own outline, and how much of the sheet ends up inked.
    fill: total / (blockWidth * blockHeight),
    // The share of the sheet the block's outline claims.
    usedArea: blockArea,
    // The share of the sheet the photos actually cover — the union, so overlap is not
    // counted twice. This is the number a "照片覆盖 ≥ 60% 画布" requirement means.
    ink: paintedCoverage(layout, board),
    blockWidthShare,
    blockHeightShare,
    heroShare,
    croppedPhotos: layout.filter((tile) => tile.crop).map((tile) => tile.id),
    reservedArea: (zones.width * zones.height) / (board.width * board.width),
    // How wide the prints come out, as a share of the sheet. The one number the
    // full-bleed template promises and the easiest one to lose silently while
    // tuning coverage.
    narrowestTileShare: layout.length ? Math.min(...layout.map((tile) => tile.width)) / board.width : 0,
    medianTileShare: layout.length
      ? [...layout.map((tile) => tile.width)].sort((a, b) => a - b)[Math.floor(layout.length / 2)] / board.width
      : 0,
  }

  const checks = 6
  const fidelity = violations.length ? 0 : Math.max(0, (checks - notes.length * 0.5) / checks)

  return { ok: violations.length === 0, violations, notes, metrics, fidelity }
}

// Human-readable report, used by the test suite and by the dev view.
export function formatReport(report) {
  const lines = []
  lines.push(`fidelity ${report.fidelity.toFixed(2)}${report.ok ? ' ✓' : ' ✗'}`)
  for (const violation of report.violations) lines.push(`  ✗ ${violation}`)
  for (const note of report.notes) lines.push(`  ! ${note}`)
  return lines.join('\n')
}
