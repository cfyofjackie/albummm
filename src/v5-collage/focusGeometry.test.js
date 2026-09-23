import { describe, expect, it } from 'vitest'
import { OCCLUDER_ALPHA, exportTransformFor, findOccluders, focusCameraFor, focusFrameFor, focusScaleFor, occluderClipPath, openingCamera } from './focusGeometry.js'

const boardRect = { left: 40, top: 300, width: 880, height: 660 }
const viewport = { width: 960, height: 760 }
const tile = {
  content: { x: 31, y: 35, width: 24, height: 32 },
}

describe('V5 focus camera', () => {
  it('starts aligned with the original board before moving', () => {
    expect(openingCamera()).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('centers the selected photo while keeping a bounded useful zoom', () => {
    const frame = focusFrameFor(viewport)
    const scale = focusScaleFor(tile, boardRect, frame)
    const camera = focusCameraFor(tile, boardRect, frame, scale)
    expect(scale).toBeGreaterThanOrEqual(1.35)
    expect(scale).toBeLessThanOrEqual(3.4)
    const photoCenterX = (tile.content.x + tile.content.width / 2) / 100 * boardRect.width
    const photoCenterY = (tile.content.y + tile.content.height / 2) / 100 * boardRect.height
    expect(frame.width / frame.height).toBeCloseTo(4 / 3)
    expect(boardRect.left + camera.x + photoCenterX * scale).toBeCloseTo(frame.left + frame.width / 2)
    expect(boardRect.top + camera.y + photoCenterY * scale).toBeCloseTo(frame.top + frame.height / 2)
  })

  it('uses distinct horizontal and vertical board units when mapping the camera to a PNG', () => {
    const frame = focusFrameFor(viewport)
    const scale = focusScaleFor(tile, boardRect, frame)
    const camera = focusCameraFor(tile, boardRect, frame, scale)
    const transform = exportTransformFor(boardRect, frame, camera)
    const centerX = (tile.content.x + tile.content.width / 2) * transform.unitX + transform.originX
    const centerY = (tile.content.y + tile.content.height / 2) * transform.unitY + transform.originY
    expect(transform.unitX).not.toBeCloseTo(transform.unitY)
    expect(centerX).toBeCloseTo(1200)
    expect(centerY).toBeCloseTo(900)
  })
})

describe('occluder clip path（幽灵层只露出遮挡者与选中照片相交的部分）', () => {
  it('equals the selected rect corners when nothing is rotated', () => {
    const selected = { x: 10, y: 20, width: 30, height: 40, rotate: 0 }
    const ghost = { x: 0, y: 0, width: 100, height: 100, rotate: 0 }
    expect(occluderClipPath(selected, ghost)).toBe('polygon(10% 20%, 40% 20%, 40% 60%, 10% 60%)')
  })

  it('maps the corners into the ghost local box accounting for the ghost rotation', () => {
    // 幽灵层绕自身中心顺时针转 90°：局部 (40,40) 会显示在视口 (60,40)。
    const selected = { x: 55, y: 35, width: 10, height: 10, rotate: 0 }
    const ghost = { x: 0, y: 0, width: 100, height: 100, rotate: 90 }
    expect(occluderClipPath(selected, ghost)).toBe('polygon(35% 45%, 35% 35%, 45% 35%, 45% 45%)')
  })

  it('keeps four vertices for rotated selections', () => {
    const selected = { x: 10, y: 20, width: 30, height: 40, rotate: -8 }
    const ghost = { x: 5, y: 15, width: 60, height: 80, rotate: 5 }
    const path = occluderClipPath(selected, ghost)
    expect(path.startsWith('polygon(')).toBe(true)
    expect(path.split(',')).toHaveLength(4)
  })
})

describe('findOccluders（谁真正压在选中照片之上）', () => {
  const layout = [
    { id: 'selected', x: 10, y: 10, width: 20, height: 20, z: 2, rotate: 0 },
    { id: 'higher-z', x: 15, y: 15, width: 20, height: 20, z: 5, rotate: 0 },
    { id: 'below-z', x: 12, y: 12, width: 5, height: 5, z: 1, rotate: 0 },
    { id: 'same-z-later', x: 10, y: 10, width: 10, height: 10, z: 2, rotate: 0 },
    { id: 'far-away', x: 80, y: 80, width: 10, height: 10, z: 9, rotate: 0 },
  ]

  it('keeps only neighbours above in stacking order that overlap the selection', () => {
    const selected = layout.find((tile) => tile.id === 'selected')
    const ids = findOccluders(layout, selected).map((tile) => tile.id)
    expect(ids).toEqual(['higher-z', 'same-z-later'])
  })

  it('returns no occluders for the topmost photo', () => {
    const top = layout.find((tile) => tile.id === 'higher-z')
    expect(findOccluders(layout, top)).toEqual([])
  })

  it('shares one opacity constant between preview and export', () => {
    expect(OCCLUDER_ALPHA).toBeGreaterThan(0)
    expect(OCCLUDER_ALPHA).toBeLessThan(0.5)
  })
})
