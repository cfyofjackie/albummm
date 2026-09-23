import { describe, expect, it } from 'vitest'
import { exportTransformFor, focusCameraFor, focusFrameFor, focusScaleFor, openingCamera } from './focusGeometry.js'

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
