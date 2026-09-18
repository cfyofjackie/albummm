import { describe, expect, it } from 'vitest'
import { sourceForV4Photo } from './photoSources.js'

describe('V4 图片源选择', () => {
  const photo = {
    previewSrc: 'data:image/jpeg;base64,preview',
    focusSrc: 'blob:original-upload',
  }

  it('总览使用轻量预览，原位聚焦改用未压缩的上传源', () => {
    expect(sourceForV4Photo(photo, false)).toBe(photo.previewSrc)
    expect(sourceForV4Photo(photo, true)).toBe(photo.focusSrc)
  })

  it('演示照片没有高清源时，原位聚焦安全回退到预览', () => {
    expect(sourceForV4Photo({ previewSrc: 'demo-preview' }, true)).toBe('demo-preview')
  })
})
