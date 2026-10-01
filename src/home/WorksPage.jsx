import { useEffect, useState } from 'react'
import { deleteWork, listWorks, MAX_WORKS, mediaBlob } from '../shared/works.js'
import './works.css'

function dateLabel(value) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(value)
}

export default function WorksPage() {
  const [works, setWorks] = useState([])
  const [thumbnails, setThumbnails] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = () => {
    listWorks().then((items) => { setWorks(items); setError('') }).catch(() => setError('无法读取本机作品，请检查浏览器设置。')).finally(() => setLoading(false))
  }

  useEffect(refresh, [])
  useEffect(() => {
    const urls = {}
    works.forEach((work) => {
      const source = mediaBlob(work.thumbnail || work.photos[0]?.file)
      if (source instanceof Blob) urls[work.id] = URL.createObjectURL(source)
    })
    setThumbnails(urls)
    return () => Object.values(urls).forEach(URL.revokeObjectURL)
  }, [works])

  const remove = async (work) => {
    if (!window.confirm(`删除《${work.title || '这份作品'}》？这台设备上的照片和设置将一起删除。`)) return
    try { await deleteWork(work.id); refresh() }
    catch { setError('删除失败，请重试。') }
  }

  return (
    <main className="works-page">
      <header><span className="works-page__brand">Albummm</span><h1>我的作品</h1><p>保存在这台设备上的作品 · {works.length}/{MAX_WORKS}</p></header>
      {loading ? <p className="works-page__message">正在读取作品…</p> : error ? <p className="works-page__message" role="alert">{error}</p> : works.length === 0 ? (
        <section className="works-page__empty"><h2>还没有作品</h2><p>选一种形式，开始制作第一份作品。</p><a href="#/">开始创作 →</a></section>
      ) : (
        <section className="works-page__grid" aria-label="已保存作品">
          {works.map((work, index) => (
            <article className="works-page__card" key={work.id}>
              <a href={`#/${work.type === 'story' ? 'story' : 'collage'}?work=${encodeURIComponent(work.id)}`} aria-label={`继续编辑${work.title || '作品'}`}>
                <span className={`works-page__thumb ${work.type === 'collage' && work.settings?.boardRatio < 1 ? 'is-portrait' : ''}`}>
                  {/* 首屏之外的缩略图懒加载：左右滑动时减少解码竞争（与 film 项目一致） */}
                  {thumbnails[work.id] && <img src={thumbnails[work.id]} alt="" loading={index < 4 ? 'eager' : 'lazy'} decoding="async" />}
                </span>
                <strong>{work.title || (work.type === 'story' ? '多页故事' : '单张拼贴')}</strong>
                <small>{work.type === 'story' ? '多页故事' : work.settings?.boardRatio < 1 ? '3:4 单张拼贴' : '4:3 单张拼贴'} · {dateLabel(work.updatedAt)} · {work.stage === 'sealed' ? '已完成' : '编辑中'}</small>
              </a>
              <button type="button" onClick={() => remove(work)} aria-label={`删除${work.title || '作品'}`}>删除</button>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
