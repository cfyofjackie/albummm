import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE_FORMAT,
  getPageFormat,
  isFullBleedCompatible,
  isSpreadBleedCompatible,
} from './pageFormat.js'

const photo = (width, height) => ({ width, height })

describe('相册开本', () => {
  it('默认使用 3:4 竖版摄影书', () => {
    expect(DEFAULT_PAGE_FORMAT).toBe('portrait')
    expect(getPageFormat().pageRatio).toBe('3 / 4')
  })

  it('未知开本回退到默认开本', () => {
    expect(getPageFormat('unknown').id).toBe(DEFAULT_PAGE_FORMAT)
  })
})

describe('自动满版保护', () => {
  it('只让比例接近页面的图片自动满版', () => {
    expect(isFullBleedCompatible(photo(3000, 4000), 'portrait')).toBe(true)
    expect(isFullBleedCompatible(photo(2000, 3000), 'portrait')).toBe(true)
    expect(isFullBleedCompatible(photo(1600, 900), 'portrait')).toBe(false)
    expect(isFullBleedCompatible(photo(1600, 1200), 'landscape')).toBe(true)
    expect(isFullBleedCompatible(photo(1600, 900), 'landscape')).toBe(false)
  })

  it('3:4 竖版书的跨页优先承接 3:2 横图', () => {
    expect(isSpreadBleedCompatible(photo(3000, 2000), 'portrait')).toBe(true)
    expect(isSpreadBleedCompatible(photo(1600, 1200), 'portrait')).toBe(true)
    expect(isSpreadBleedCompatible(photo(1600, 900), 'portrait')).toBe(false)
  })
})
