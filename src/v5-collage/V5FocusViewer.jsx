import { useEffect, useMemo, useRef, useState } from 'react'
import { BoardDecorations, CardDecoration } from './V5Decorations.jsx'
import { downloadBlob, exportFocusImage, exportTiersFor, renderVisibleRegion } from './focusExport.js'
import { findOccluders, focusCameraFor, focusFrameFor, focusScaleFor, occluderClipPath, occluderMaskImage, openingCamera } from './focusGeometry.js'

const TRANSITION_MS = 420

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight }
}

function photoStyleFor(tile) {
  return {
    left: `${((tile.content.x - tile.x) / tile.width) * 100}%`,
    top: `${((tile.content.y - tile.y) / tile.height) * 100}%`,
    width: `${(tile.content.width / tile.width) * 100}%`,
    height: `${(tile.content.height / tile.height) * 100}%`,
  }
}

// 高清层在查看层打开时立即挂载（不等镜头停稳）；它不按视口像素定位，而是放进
// 与整板共用同一组镜头坐标、同一条 transform 过渡的同步层里，按拼贴百分比定位。
// 几何与整板快照里的同一张照片逐像素重合，挂载不可见。先渲染 1600px 预览图——
// 在最高 3.4 倍镜头下已接近屏幕 1:1，全程清晰；原图解码完成后换源，点开后逐渐
// 变得更清楚，而不是等停稳才从糊图突然变清。镜头无论放大、切换还是返回，它都
// 与整板逐帧同轨迹（纯 transform 合成动画，不走 left/top 布局过渡），关闭时即时启程。

function FocusCard({ tile, index, frameMode, decorationEnabled, className = '', style, onClick, ariaHidden = false, useOriginal = false }) {
  return (
    <figure
      className={`v5-collage__photo v5-collage__photo--${frameMode} ${className}`}
      style={style}
      onClick={onClick}
      aria-hidden={ariaHidden || undefined}
    >
      {frameMode === 'polaroid' && <span className="v5-collage__paper" aria-hidden="true" />}
      <img style={photoStyleFor(tile)} src={(useOriginal && tile.photo.originalSrc) || tile.photo.previewSrc} alt="" />
      <CardDecoration index={index} enabled={decorationEnabled} />
    </figure>
  )
}

export default function V5FocusViewer({ layout, initialTileId, boardRect, frameMode, decorationEnabled, autoPlacements, boardPreviewSrc, background, boardRatio, onClose }) {
  const initialTile = useMemo(() => layout.find((tile) => tile.id === initialTileId) || layout[0], [initialTileId, layout])
  const [selectedId, setSelectedId] = useState(initialTile.id)
  const [viewport, setViewport] = useState(viewportSize)
  const frame = useMemo(() => focusFrameFor(viewport, boardRatio), [viewport.height, viewport.width, boardRatio])
  const exportTiers = useMemo(() => exportTiersFor(boardRatio), [boardRatio])
  const [camera, setCamera] = useState(openingCamera)
  const [settled, setSettled] = useState(false)
  const [decodedOriginalIds, setDecodedOriginalIds] = useState(() => new Set())
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [exportingId, setExportingId] = useState(null)
  const settleTimerRef = useRef(null)
  const closeTimerRef = useRef(null)
  const frameMountedRef = useRef(false)
  // iOS Safari 可能把缩放中的整板快照光栅化得偏软；高清层打开即覆盖选中照片补回清晰度。
  const selectedTile = layout.find((tile) => tile.id === selectedId)
  const occluders = useMemo(() => findOccluders(layout, selectedTile), [layout, selectedTile])
  // 周围高清区域：停稳后用原图重绘当前可见画面（临时图层，盖上仍偏软的快照）。
  // 镜头一动就立刻撤掉（内容与快照一致，撤下不闪），停稳后重绘并淡入。
  const [regionUrl, setRegionUrl] = useState(null)
  const [regionReady, setRegionReady] = useState(false)
  const regionBlobRef = useRef(null)
  const regionSeqRef = useRef(0)

  const clearRegion = () => {
    regionSeqRef.current += 1
    if (regionBlobRef.current) { URL.revokeObjectURL(regionBlobRef.current); regionBlobRef.current = null }
    setRegionReady(false)
    setRegionUrl(null)
  }

  useEffect(() => {
    if (!settled || leaving || !selectedTile) return
    let active = true
    const seq = ++regionSeqRef.current
    // 原图已在打开/切换时并行解码（见上方 decode effect），这里的绘制大多直接命中缓存。
    renderVisibleRegion({ layout, frameMode, decorationEnabled, autoPlacements, boardRect, frame, camera, background })
      .then(async (canvas) => {
        if (!active || !canvas) return
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
        if (!active || !blob) return
        const url = URL.createObjectURL(blob)
        if (!active) { URL.revokeObjectURL(url); return }
        if (regionBlobRef.current) URL.revokeObjectURL(regionBlobRef.current)
        regionBlobRef.current = url
        setRegionReady(false)
        setRegionUrl(url)
        if (seq !== regionSeqRef.current) return
      })
      .catch(() => {})
    return () => { active = false }
  }, [settled, leaving, selectedId, frame.height, frame.width, camera, background])
  useEffect(() => () => {
    if (regionBlobRef.current) URL.revokeObjectURL(regionBlobRef.current)
  }, [])


  useEffect(() => {
    if (leaving) return
    let active = true
    // 原图的解码和高清层的换源都在打开/切换的那一刻开始，与镜头动画并行；
    // 解码完成后换源，照片在动画过程中就逐渐变清。decode() 离主线程执行，
    // 不会像整板重绘那样抢动画的主线程。
    ;[selectedTile, ...occluders].filter(Boolean).forEach((tile) => {
      const source = tile.photo.originalSrc
      if (!source || source === tile.photo.previewSrc || decodedOriginalIds.has(tile.id)) return
      const image = new Image()
      image.src = source
      const ready = () => {
        if (!active) return
        setDecodedOriginalIds((ids) => new Set(ids).add(tile.id))
      }
      if (image.decode) image.decode().then(ready).catch(() => {})
      else image.onload = ready
    })
    return () => { active = false }
  }, [selectedTile, occluders, leaving])

  // settled 只服务导出：镜头停稳前不开放导出按钮。高清层本身不等停稳。
  const settleDetail = () => {
    window.clearTimeout(settleTimerRef.current)
    // transitionend 对齐真正停下的那一帧；计时器只处理未派发事件的浏览器。
    settleTimerRef.current = window.setTimeout(() => {
      setSettled(true)
    }, TRANSITION_MS + 100)
  }

  const finishMotion = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform' || leaving) return
    window.clearTimeout(settleTimerRef.current)
    setSettled(true)
  }

  useEffect(() => {
    const onResize = () => setViewport(viewportSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => () => {
    window.clearTimeout(settleTimerRef.current)
    window.clearTimeout(closeTimerRef.current)
  }, [])
  useEffect(() => {
    const scale = focusScaleFor(initialTile, boardRect, frame)
    const animationFrame = requestAnimationFrame(() => {
      setVisible(true)
      setCamera(focusCameraFor(initialTile, boardRect, frame, scale))
      settleDetail()
    })
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  useEffect(() => {
    if (!frameMountedRef.current) {
      frameMountedRef.current = true
      return
    }
    if (!visible) return
    const tile = layout.find((item) => item.id === selectedId) || initialTile
    const scale = focusScaleFor(tile, boardRect, frame)
    setSettled(false)
    setCamera(focusCameraFor(tile, boardRect, frame, scale))
    settleDetail()
  }, [frame.height, frame.width, frame.left, frame.top])

  const closeViewer = () => {
    if (leaving) return
    // 高清层在同步层里与整板同轨迹飞回，无需先淡出交接：点击下一帧即启程，
    // 全程保持原生清晰度，动画结束后随查看层一起卸载。
    window.clearTimeout(settleTimerRef.current)
    setLeaving(true)
    setVisible(false)
    setCamera(openingCamera())
    closeTimerRef.current = window.setTimeout(onClose, TRANSITION_MS)
  }

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') closeViewer() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeViewer])

  const moveToTile = (tile) => {
    if (leaving) return
    // 再点当前选中的照片 = 返回完整拼贴；点其他照片只移动镜头。
    if (tile.id === selectedId) {
      closeViewer()
      return
    }
    // 新选中照片的高清层立刻按旧镜头坐标出现在快照正上方（几何完全重合），
    // 随后与整板一起飞向新镜头，全程清晰；切换动作点击即开始。
    // settled 归位 false：移动期间撤下周围高清区域（内容与快照一致，撤下不闪），
    // 导出按钮在到达前暂不可用；停稳后重绘当前可见区域。
    setSettled(false)
    setSelectedId(tile.id)
    setCamera((current) => focusCameraFor(tile, boardRect, frame, current.scale))
    settleDetail()
  }

  const exportCurrentView = async (tier) => {
    if (exportingId || !settled) return
    setExportingId(tier.id)
    try {
      const blob = await exportFocusImage({ layout, selectedId, frameMode, decorationEnabled, autoPlacements, boardRect, frame, camera, tier, background })
      downloadBlob(blob, `albummm-v5-focus-${tier.width}x${tier.height}.${tier.ext}`)
    } catch (error) {
      console.error('V5 focus export failed', error?.type, error?.target?.currentSrc || error?.target?.src || error)
    } finally {
      setExportingId(null)
    }
  }

  // 画框（外框线 + 遮带）固定在视口上，与镜头动画零耦合：随查看层打开即显示。
  // 若等镜头停稳才显示，停稳后画框才浮现，看起来就像突然被裁切进取景框。
  // 高清细节层同样打开即挂载（见组件顶部注释）；settled 只控制导出按钮。
  return (
    <section className={`v5-focus ${visible ? 'is-visible' : ''} ${visible && !leaving ? 'is-framed' : ''} ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="高清拼贴查看">
      <div className="v5-focus__viewport">
        <div className="v5-focus__artboard">
          <div className="v5-focus__frame-backing" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height, backgroundColor: background.color }} aria-hidden="true" />
          <div
            className="v5-collage__board v5-focus__board"
            style={{ left: `${boardRect.left}px`, top: `${boardRect.top}px`, width: `${boardRect.width}px`, aspectRatio: boardRatio, transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`, backgroundColor: background.color, backgroundImage: background.image ? `url("${background.image}")` : undefined, backgroundSize: 'cover' }}
            onTransitionEnd={finishMotion}
          >
            {boardPreviewSrc
              ? <img className="v5-focus__board-preview" src={boardPreviewSrc} alt="" aria-hidden="true" />
              : <BoardDecorations enabled={decorationEnabled} autoPlacements={autoPlacements} />}
            {layout.map((tile, index) => (
              <figure
                key={tile.id}
                className={`v5-collage__photo v5-collage__photo--${boardPreviewSrc ? 'none' : frameMode} v5-focus__photo ${tile.id === selectedId ? 'is-selected' : ''}`}
                style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.width}%`, height: `${tile.height}%`, zIndex: tile.z, transform: `rotate(${tile.rotate}deg)` }}
                onClick={() => moveToTile(tile)}
                role="button"
                aria-label={`查看第 ${index + 1} 张照片`}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    moveToTile(tile)
                  }
                }}
              >
                {!boardPreviewSrc && frameMode === 'polaroid' && <span className="v5-collage__paper" aria-hidden="true" />}
                {!boardPreviewSrc && <img style={photoStyleFor(tile)} src={tile.photo.previewSrc} alt={`查看第 ${index + 1} 张照片`} />}
                {!boardPreviewSrc && <CardDecoration index={index} enabled={decorationEnabled} />}
              </figure>
            ))}
          </div>
          {regionUrl && (
            <img
              className={`v5-focus__region ${regionReady ? 'is-ready' : ''}`}
              src={regionUrl}
              style={{ left: `${frame.left}px`, top: `${frame.top}px`, width: `${frame.width}px`, height: `${frame.height}px` }}
              onLoad={() => setRegionReady(true)}
              alt=""
              aria-hidden="true"
            />
          )}
          {selectedTile && (
            <div
              className="v5-focus__detail"
              style={{ left: `${boardRect.left}px`, top: `${boardRect.top}px`, width: `${boardRect.width}px`, height: `${boardRect.height}px`, transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}
            >
              <FocusCard
                tile={selectedTile}
                index={layout.indexOf(selectedTile)}
                frameMode={frameMode}
                decorationEnabled={decorationEnabled}
                className="v5-focus__hires"
                style={{ left: `${selectedTile.x}%`, top: `${selectedTile.y}%`, width: `${selectedTile.width}%`, height: `${selectedTile.height}%`, transform: `rotate(${selectedTile.rotate}deg)` }}
                onClick={closeViewer}
                useOriginal={decodedOriginalIds.has(selectedTile.id)}
              />
              {occluders.map((tile) => {
                const maskImage = occluderMaskImage(selectedTile, tile)
                return (
                  <FocusCard
                    key={`ghost-${tile.id}`}
                    tile={tile}
                    index={layout.indexOf(tile)}
                    frameMode={frameMode}
                    decorationEnabled={decorationEnabled}
                    className="v5-focus__ghost"
                    style={{
                      left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.width}%`, height: `${tile.height}%`,
                      transform: `rotate(${tile.rotate}deg)`,
                      clipPath: occluderClipPath(selectedTile, tile),
                      maskImage,
                      WebkitMaskImage: maskImage,
                      maskSize: '100% 100%',
                      WebkitMaskSize: '100% 100%',
                    }}
                    ariaHidden
                    useOriginal={decodedOriginalIds.has(tile.id)}
                  />
                )
              })}
            </div>
          )}
          <div className="v5-focus__frame-mask" style={{ top: 0, left: 0, right: 0, height: frame.top }} aria-hidden="true" />
          <div className="v5-focus__frame-mask" style={{ top: frame.top + frame.height, left: 0, right: 0, bottom: 0 }} aria-hidden="true" />
          <div className="v5-focus__frame-mask" style={{ top: frame.top, left: 0, width: frame.left, height: frame.height }} aria-hidden="true" />
          <div className="v5-focus__frame-mask" style={{ top: frame.top, left: frame.left + frame.width, right: 0, height: frame.height }} aria-hidden="true" />
          <div className="v5-focus__frame-outline" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }} aria-hidden="true" />
        </div>
        <p className="v5-focus__frame-label" style={{ left: `${frame.left + 12}px`, top: `${frame.top + 12}px` }} aria-hidden="true">导出范围 · {boardRatio > 1 ? '4:3' : '3:4'}</p>
      </div>
      <div className="v5-focus__exports">
        {exportTiers.map((tier) => (
          <button
            key={tier.id}
            type="button"
            className="v5-focus__export"
            title={tier.note}
            disabled={Boolean(exportingId) || !settled || leaving}
            onClick={() => exportCurrentView(tier)}
          >
            {exportingId === tier.id ? '正在导出…' : tier.label}
          </button>
        ))}
      </div>
      <button type="button" className="v5-focus__close" onClick={closeViewer} aria-label="返回完整拼贴">×</button>
      <p className="v5-focus__hint">点周围照片移动镜头 · 再点当前照片或按 Esc 返回</p>
    </section>
  )
}
