import { describe, expect, it } from 'vitest'
import { visibleTilesFor } from './focusExport.js'

describe('V5 visible-region rendering', () => {
  it('renders only cards touching the visible crop and separates the selected card for focus compositing', () => {
    const layout = [
      { id: 'outside', x: 5, y: 20, width: 12, height: 12, rotate: 0, z: 1 },
      { id: 'edge', x: 47, y: 30, width: 4, height: 12, rotate: 20, z: 2 },
      { id: 'inside', x: 60, y: 40, width: 20, height: 20, rotate: 0, z: 3 },
      { id: 'selected', x: 55, y: 45, width: 20, height: 20, rotate: 0, z: 4 },
    ]
    const transform = { originX: -500, originY: -250, unitX: 10, unitY: 10 }
    expect(visibleTilesFor(layout, transform, 500, 500, 'selected').map(({ tile }) => tile.id)).toEqual(['edge', 'inside'])
  })
})
