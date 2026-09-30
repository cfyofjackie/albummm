import { useEffect, useMemo, useRef, useState } from 'react'
import { makeDemoPhotos } from '../shared/demo.js'
import { loadPhoto, releasePhotoSource } from '../shared/photo.js'
import { listWorks, loadWork, restorePhotos } from '../shared/works.js'
import { REQUIRED_PHOTO_COUNT, buildReferenceLayout } from '../v5-collage/layout.js'
import { backgroundFor, backgroundStyle } from '../v5-collage/backgrounds.js'
import { focusFrameFor, focusScaleBreakdown } from '../v5-collage/focusGeometry.js'
import V5FocusViewer from '../v5-collage/V5FocusViewer.jsx'
import './focusDebug.css'

// 开发者调试页（#/dev/focus，仅 dev 构建注册）：给 V5 放大倍率做逐张、逐位置的
// 参数对比。系数只作用于 focusScaleFor 的最终倍率，本地 localStorage 保存，
// 不写入作品数据。正式构建没有这条路由。

const STORAGE_KEY = 'albummm-dev-focus'
const DEFAULT_PARAMS = { factor: 1, boardRatio: 4 / 3, photoIndex: 0, sourceId: 'demo' }

function loadParams() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const params = { ...DEFAULT_PARAMS, ...raw }
    if (!Number.isFinite(params.factor) || params.factor <= 0) params.factor = 1
    if (params.boardRatio !== 4 / 3 && params.boardRatio !== 3 / 4) params.boardRatio = 4 / 3
    if (!Number.isInteger(params.photoIndex) || params.photoIndex < 0 || params.photoIndex >= REQUIRED_PHOTO_COUNT) params.photoIndex = 0
    return params
  } catch {
    return { ...DEFAULT_PARAMS }
  }
}

export default function FocusDebugPage() {
  const initial = useRef(loadParams())
  const boardRef = useRef(null)
  const photosRef = useRef([])
  const [sourceId, setSourceId] = useState(initial.current.sourceId)
  const [sources, setSources] = useState([])
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [factor, setFactor] = useState(initial.current.factor)
  const [boardRatio, setBoardRatio] = useState(initial.current.boardRatio)
  const [photoIndex, setPhotoIndex] = useState(initial.current.photoIndex)
  const [viewer, setViewer] = useState(null) // { boardRect }
  const [panelOpen, setPanelOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ factor, boardRatio, photoIndex, sourceId }))
  }, [factor, boardRatio, photoIndex, sourceId])

  // 作品库里的拼贴作品 + 演示照片，供调试数据源切换
  useEffect(() => {
    let active = true
    listWorks()
      .then((works) => {
        if (!active) return
        const collageWorks = works.filter((work) => work.type === 'collage')
        setSources(collageWorks.map((work) => ({ id: work.id, label: work.title || '未命名拼贴' })))
        if (sourceId !== 'demo' && !collageWorks.some((work) => work.id === sourceId)) setSourceId('demo')
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    photosRef.current.forEach(releasePhotoSource)
    if (sourceId === 'demo') {
      makeDemoPhotos(20).then((demo) => {
        if (!active) { demo.forEach(releasePhotoSource); return }
        const accepted = demo.slice(0, REQUIRED_PHOTO_COUNT)
        demo.filter((photo) => !accepted.includes(photo)).forEach(releasePhotoSource)
        photosRef.current = accepted
        setPhotos(accepted)
        setLoading(false)
      })
      return () => { active = false }
    }
    loadWork(sourceId).then(async (work) => {
      if (!active) return
      if (!work || work.type !== 'collage') { setPhotos([]); setLoading(false); return }
      const restored = await restorePhotos(work.photos, loadPhoto)
      if (!active) { restored.forEach(releasePhotoSource); return }
      photosRef.current = restored
      setPhotos(restored)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sourceId])

  const layout = useMemo(
    () => (photos.length === REQUIRED_PHOTO_COUNT ? buildReferenceLayout(photos, 'none', boardRatio) : []),
    [photos, boardRatio],
  )
  const background = backgroundFor('warm')
  const frame = useMemo(() => focusFrameFor(viewport, boardRatio), [viewport.height, viewport.width, boardRatio])
  const selectedTile = layout[photoIndex] || null
  const boardRect = useMemo(() => (viewer?.boardRect ?? boardRef.current?.getBoundingClientRect() ?? null), [viewer, boardRatio, layout, viewport])

  const breakdown = useMemo(() => (
    selectedTile && boardRect ? focusScaleBreakdown(selectedTile, boardRect, frame, factor) : null
  ), [selectedTile, boardRect, frame, factor])

  const setFactorValue = (value) => {
    const next = Math.max(0.5, Math.min(4, Math.round(value * 100) / 100))
    setFactor(next)
  }

  const copyParams = async () => {
    const ratioLabel = boardRatio === 3 / 4 ? '3:4' : '4:3'
    const text = `boardRatio=${ratioLabel} photo=${photoIndex + 1}/${REQUIRED_PHOTO_COUNT} factor=${factor.toFixed(2)}`
    try { await navigator.clipboard.writeText(text) } catch { /* 剪贴板不可用时忽略 */ }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const openViewer = () => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect || !layout.length) return
    setViewer({ boardRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } })
  }

  const pickPhoto = (index) => {
    setPhotoIndex(index)
    openViewer()
  }

  return (
    <main className="dev-focus">
      <header className="dev-focus__bar">
        <a href="#/" className="dev-focus__back">← 返回</a>
        <strong>开发者调试 · 放大倍率</strong>
        <span className="dev-focus__note">仅开发环境可用，参数只保存在本页</span>
      </header>

      <section className="dev-focus__controls">
        <label>
          数据源
          <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
            <option value="demo">演示照片</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
          </select>
        </label>
        <div className="dev-focus__group" role="group" aria-label="作品比例">
          <span>比例</span>
          {[4 / 3, 3 / 4].map((ratio) => (
            <button key={ratio} type="button" className={boardRatio === ratio ? 'is-active' : ''} onClick={() => setBoardRatio(ratio)}>
              {ratio > 1 ? '4:3' : '3:4'}
            </button>
          ))}
        </div>
        <div className="dev-focus__group" role="group" aria-label="选择照片">
          <span>照片</span>
          {Array.from({ length: REQUIRED_PHOTO_COUNT }, (_, index) => (
            <button
              key={index}
              type="button"
              className={photoIndex === index ? 'is-active' : ''}
              onClick={() => pickPhoto(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </section>

      <section className="dev-focus__stage">
        {loading ? <p>正在准备照片…</p> : (
          <div
            className="dev-focus__board"
            ref={boardRef}
            style={{ ...backgroundStyle(background), aspectRatio: boardRatio, '--v5-board-color': background.color }}
            onClick={openViewer}
            role="button"
            tabIndex={0}
            aria-label="打开放大查看"
          >
            {layout.map((tile, index) => (
              <figure
                key={tile.id}
                className={`dev-focus__photo ${index === photoIndex ? 'is-selected' : ''}`}
                style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.width}%`, height: `${tile.height}%`, zIndex: tile.z, transform: `rotate(${tile.rotate}deg)` }}
              >
                <img
                  style={{
                    left: `${((tile.content.x - tile.x) / tile.width) * 100}%`,
                    top: `${((tile.content.y - tile.y) / tile.height) * 100}%`,
                    width: `${(tile.content.width / tile.width) * 100}%`,
                    height: `${(tile.content.height / tile.height) * 100}%`,
                  }}
                  src={tile.photo.previewSrc}
                  alt=""
                />
              </figure>
            ))}
          </div>
        )}
        <p className="dev-focus__tip">点画布或照片编号打开查看层；点击画布上的照片可切换镜头。</p>
      </section>

      {viewer && selectedTile && (
        <V5FocusViewer
          key={`${sourceId}-${boardRatio}-${photoIndex}`}
          layout={layout}
          initialTileId={selectedTile.id}
          boardRect={viewer.boardRect}
          frameMode="none"
          decorationEnabled={false}
          autoPlacements={[]}
          background={backgroundFor('warm')}
          boardRatio={boardRatio}
          scaleFactor={factor}
          onClose={() => setViewer(null)}
        />
      )}

      <button type="button" className="dev-focus__toggle" onClick={() => setPanelOpen((open) => !open)}>
        {panelOpen ? '收起面板' : '调试面板'}
      </button>
      {panelOpen && (
        <aside className="dev-focus__panel">
          <strong>放大倍率</strong>
          <div className="dev-focus__row">
            <label>
              系数
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="4"
                value={factor}
                onChange={(event) => setFactorValue(Number(event.target.value) || 1)}
              />
            </label>
            <button type="button" onClick={() => setFactorValue(1)}>恢复默认</button>
            <button type="button" onClick={copyParams}>{copied ? '已复制' : '复制当前参数'}</button>
          </div>
          {breakdown ? (
            <>
              <dl>
                <dt>当前照片</dt>
                <dd>{photoIndex + 1} / {REQUIRED_PHOTO_COUNT}</dd>
                <dt>位置（中心）</dt>
                <dd>{breakdown.centerX.toFixed(1)} × {breakdown.centerY.toFixed(1)} px</dd>
                <dt>基础倍率</dt>
                <dd>{breakdown.baseScale.toFixed(2)}</dd>
                <dt>边缘安全最低倍率</dt>
                <dd>{breakdown.edgeScale.toFixed(2)}</dd>
                <dt className={breakdown.finalScale < breakdown.edgeScale ? 'is-below-safe' : ''}>
                  最终倍率{breakdown.finalScale < breakdown.edgeScale ? '（低于安全倍率）' : ''}
                </dt>
                <dd className={breakdown.finalScale < breakdown.edgeScale ? 'is-below-safe' : ''}>{breakdown.finalScale.toFixed(2)}</dd>
                <dt>导出范围四边</dt>
                <dd className="dev-focus__edges">
                  {(['left', 'right', 'top', 'bottom']).map((side) => (
                    <span key={side} className={breakdown.edges[side] ? 'is-exposed' : ''}>
                      {side === 'left' ? '左' : side === 'right' ? '右' : side === 'top' ? '上' : '下'}
                      {breakdown.edges[side] ? '露' : '盖'}
                    </span>
                  ))}
                </dd>
              </dl>
              {breakdown.finalScale < breakdown.edgeScale && (
                <p className="dev-focus__warn">当前倍率低于画布盖住导出框的最低值，四周会露出画布底色。</p>
              )}
            </>
          ) : (
            <p className="dev-focus__warn">等待照片就绪…</p>
          )}
        </aside>
      )}
    </main>
  )
}
