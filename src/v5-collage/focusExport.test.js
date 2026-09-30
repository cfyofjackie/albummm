import { describe, expect, it } from 'vitest'
import { EXPORT_TIERS, exportTiersFor } from './focusExport.js'

describe('V5 export tiers', () => {
  it('keeps landscape tiers and derives portrait equivalents', () => {
    expect(EXPORT_TIERS.every((tier) => tier.width === 1600 || tier.width === 2400)).toBe(true)
    const portrait = exportTiersFor(3 / 4)
    expect(portrait.map((tier) => `${tier.width}x${tier.height}`)).toEqual(['1200x1600', '1800x2400', '1800x2400'])
    expect(portrait.map((tier) => tier.ext)).toEqual(['jpg', 'jpg', 'png'])
  })
})
