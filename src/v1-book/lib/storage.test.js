import { describe, it, expect } from 'vitest'
import { toRecord, fromRecord } from './storage.js'

const photo = (id) => ({
  id,
  name: `${id}.jpg`,
  width: 1600,
  height: 1200,
  orientation: 'landscape',
  previewSrc: `data:image/jpeg;base64,${id}`,
})

const book = {
  id: 'b1',
  title: '海边',
  style: 'studio',
  formatId: 'portrait',
  seed: 12345,
  photos: [photo('p1'), photo('p2')],
}

describe('书库记录（持久化用的序列化）', () => {
  it('只写可序列化字段，派生数据不入库', () => {
    const record = toRecord({ ...book, pages: [{ type: 'cover' }], photosById: { p1: photo('p1') } })
    expect(record).not.toHaveProperty('pages')
    expect(record).not.toHaveProperty('photosById')
    expect(record.photos).toHaveLength(2)
    expect(record.photos[0].previewSrc).toContain('data:image/jpeg')
  })

  it('读回来补齐书架画封面要用的派生字段', () => {
    const restored = fromRecord(toRecord(book))
    expect(restored.title).toBe('海边')
    expect(restored.seed).toBe(12345)
    expect(restored.pageRatio).toBeDefined()
    expect(restored.coverColor.hex).toMatch(/^#/)
    expect(restored.photos).toHaveLength(2)
  })

  it('脏数据整本丢掉，不抛错', () => {
    expect(fromRecord(null)).toBeNull()
    expect(fromRecord({ id: 'x' })).toBeNull()
    expect(fromRecord({ id: 'x', photos: [] })).toBeNull()
    // 有图但缺 previewSrc：也丢掉（否则书架会画出一个空白封面）
    expect(fromRecord({ id: 'x', photos: [{ id: 'p1' }] })).toBeNull()
  })
})
