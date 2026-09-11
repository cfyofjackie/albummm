import { describe, it, expect } from 'vitest'
import { BLANK_PAGE, buildLeaves, flatIndexOf, leafOfFlat } from './book.js'

const page = (type, id) => ({ type, layoutId: type, imageIds: [], id })

describe('buildLeaves 装订', () => {
  it('封面独占、封底独占、内容页两两配对', () => {
    const pages = [
      page('cover'),
      page('single', 'a'),
      page('double', 'b'),
      page('single', 'c'),
      page('back'),
    ]
    const leaves = buildLeaves(pages)
    expect(leaves).toHaveLength(4)
    expect(leaves[0]).toEqual([pages[0]])
    expect(leaves[1]).toEqual([pages[1], pages[2]])
    expect(leaves[2]).toEqual([pages[3], BLANK_PAGE])
    expect(leaves[3]).toEqual([pages[4]])
  })

  it('偶数内容页不补空白', () => {
    const pages = [page('cover'), page('single', 'a'), page('single', 'b'), page('back')]
    const leaves = buildLeaves(pages)
    expect(leaves).toHaveLength(3)
    expect(leaves[1]).toEqual([pages[1], pages[2]])
  })

  it('校验封面封底与最小长度', () => {
    expect(() => buildLeaves([page('single', 'a')])).toThrow()
    expect(() => buildLeaves([page('single', 'a'), page('back')])).toThrow()
    expect(() => buildLeaves([page('cover'), page('single', 'a')])).toThrow()
  })
})

describe('flatIndexOf 扁平索引映射', () => {
  const pages = [
    page('cover'), // 0
    page('single', 'a'), // 1
    page('double', 'b'), // 2
    page('single', 'c'), // 3
    page('back'), // 4
  ]
  const leaves = buildLeaves(pages)

  it('封面 leaf 只有右侧', () => {
    expect(flatIndexOf(leaves, 0, 'right', pages.length)).toBe(0)
    expect(flatIndexOf(leaves, 0, 'left', pages.length)).toBeNull()
  })

  it('封底 leaf 只有左侧', () => {
    expect(flatIndexOf(leaves, 3, 'left', pages.length)).toBe(4)
    expect(flatIndexOf(leaves, 3, 'right', pages.length)).toBeNull()
  })

  it('内容 spread 按配对顺序映射', () => {
    expect(flatIndexOf(leaves, 1, 'left', pages.length)).toBe(1)
    expect(flatIndexOf(leaves, 1, 'right', pages.length)).toBe(2)
    expect(flatIndexOf(leaves, 2, 'left', pages.length)).toBe(3) // 空白页所在侧无索引需求
  })
})

describe('leafOfFlat 扁平页码 → leaf', () => {
  const pages = [page('cover'), page('single', 'a'), page('double', 'b'), page('single', 'c'), page('back')]
  const leaves = buildLeaves(pages)

  it('与 flatIndexOf 互逆', () => {
    expect(leafOfFlat(0, leaves, pages.length)).toBe(0)
    expect(leafOfFlat(1, leaves, pages.length)).toBe(1)
    expect(leafOfFlat(2, leaves, pages.length)).toBe(1)
    expect(leafOfFlat(3, leaves, pages.length)).toBe(2)
    expect(leafOfFlat(4, leaves, pages.length)).toBe(3)
  })
})
