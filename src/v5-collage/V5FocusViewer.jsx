import { useEffect, useMemo, useRef, useState } from 'react'
import { BoardDecorations, CardDecoration } from './V5Decorations.jsx'
import { EXPORT_TIERS, downloadBlob, exportFocusImage } from './focusExport.js'
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

// 高清层只在镜头停稳后挂载；它不按视口像素定位，而是放进与整板共用同一组
// 镜头坐标、同一条 transform 过渡的同步层里，按拼贴百分比定位。镜头无论
// 放大、切换还是返回，它都与整板逐帧同轨迹（纯 transform 合成动画，不走
// left/top 布局过渡），关闭时即时启程、全程保持原生清晰度。

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

export default function V5FocusViewer({ layout, initialTileId, boardRect, frameMode, decorationEnabled, autoPlacements, boardPreviewSrc, onClose }) {
  const initialTile = useMemo(() => layout.find((tile) => tile.id === initialTileId) || layout[0], [initialTileId, layout])
  const [selectedId, setSelectedId] = useState(initialTile.id)
  const [viewport, setViewport] = useState(viewportSize)
  const frame = useMemo(() => focusFrameFor(viewport), [viewport.height, viewport.width])
  const [camera, setCamera] = useState(openingCamera)
  const [detailReady, setDetailReady] = useState(false)
  const [decodedOriginalIds, setDecodedOriginalIds] = useState(() => new Set())
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [exportingId, setExportingId] = useState(null)
  const settleTimerRef = useRef(null)
  const closeTimerRef = useRef(null)
  const frameMountedRef = useRef(false)
  // iOS Safari 可能把缩放中的整板光栅化得偏软；镜头落定后用独立高清层补回清晰度。
  const selectedTile = layout.find((tile) => tile.id === selectedId)
  const occluders = useMemo(() => findOccluders(layout, selectedTile), [layout, selectedTile])

  useEffect(() => {
    if (!detailReady || leaving) return
    let active = true
    // 原图的解码和高清层的换源都放在镜头停稳之后，避免 Safari 在缩放时抢主线程。
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
  }, [detailReady, selectedTile, occluders, leaving])

  const settleDetail = () => {
    window.clearTimeout(settleTimerRef.current)
    // transitionend 对齐真正停下的那一帧；计时器只处理未派发事件的浏览器。
    settleTimerRef.current = window.setTimeout(() => {
      setDetailReady(true)
    }, TRANSITION_MS + 100)
  }

  const finishMotion = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform' || leaving) return
    window.clearTimeout(settleTimerRef.current)
    setDetailReady(true)
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
    setDetailReady(false)
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
    setSelectedId(tile.id)
    setCamera((current) => focusCameraFor(tile, boardRect, frame, current.scale))
    settleDetail()
  }

  const exportCurrentView = async (tier) => {
    if (exportingId || !detailReady) return
    setExportingId(tier.id)
    try {
      // 与预览共用固定 4:3 成品框和同一份镜头坐标；外围窗口区域从不进入导出。
      const blob = await exportFocusImage({ layout, selectedId, frameMode, decorationEnabled, autoPlacements, boardRect, frame, camera, tier })
      downloadBlob(blob, `albummm-v5-focus-${tier.width}x${tier.height}.${tier.ext}`)
    } catch (error) {
      console.error('V5 focus export failed', error?.type, error?.target?.currentSrc || error?.target?.src || error)
    } finally {
      setExportingId(null)
    }
  }

  // 画框（外框线 + 遮带）固定在视口上，与镜头动画零耦合：随查看层打开即显示。
  // 若等镜头停稳才显示，停稳后画框才浮现，看起来就像突然被裁切进取景框。
  // 需要等停稳的只有高清细节层（解码换源），见 detailReady。
  return (
    <section className={`v5-focus ${visible ? 'is-visible' : ''} ${visible && !leaving ? 'is-framed' : ''} ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="高清拼贴查看">
      <div className="v5-focus__viewport">
        <div className="v5-focus__artboard">
          <div className="v5-focus__frame-backing" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }} aria-hidden="true" />
          <div
            className="v5-collage__board v5-focus__board"
            style={{ left: `${boardRect.left}px`, top: `${boardRect.top}px`, width: `${boardRect.width}px`, transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}
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
          {detailReady && selectedTile && (
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
        <p className="v5-focus__frame-label" style={{ left: `${frame.left + 12}px`, top: `${frame.top + 12}px` }} aria-hidden="true">导出范围 · 4:3</p>
      </div>
      <div className="v5-focus__exports">
        {EXPORT_TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            className="v5-focus__export"
            title={tier.note}
            disabled={Boolean(exportingId) || !detailReady || leaving}
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
