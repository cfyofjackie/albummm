import { useEffect, useMemo, useState } from 'react'
import { BoardDecorations, CardDecoration } from './V5Decorations.jsx'
import { EXPORT_TIERS, downloadBlob, exportFocusImage } from './focusExport.js'
import { OCCLUDER_ALPHA, findOccluders, focusCameraFor, focusFrameFor, focusScaleFor, occluderClipPath, openingCamera } from './focusGeometry.js'

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

// 高清层 / 幽灵层始终按「当前镜头状态下的最终像素矩形」定位（不经 CSS scale，
// 任何时刻都是原生分辨率渲染）。left/top/width/height 的 CSS 过渡与整板的
// transform 过渡同时长同缓动：整板平移/缩放时它们逐帧跟随，点击瞬间即出现。
function overlayRectFor(tile, boardRect, frame, camera) {
  const scale = camera.scale
  return {
    left: `${boardRect.left - frame.left + camera.x + (scale * tile.x / 100) * boardRect.width}px`,
    top: `${boardRect.top - frame.top + camera.y + (scale * tile.y / 100) * boardRect.height}px`,
    width: `${(scale * tile.width / 100) * boardRect.width}px`,
    height: `${(scale * tile.height / 100) * boardRect.height}px`,
    transform: `rotate(${tile.rotate}deg)`,
  }
}

function FocusCard({ tile, index, frameMode, decorationEnabled, className = '', style, onClick, ariaHidden = false }) {
  return (
    <figure
      className={`v5-collage__photo v5-collage__photo--${frameMode} ${className}`}
      style={style}
      onClick={onClick}
      aria-hidden={ariaHidden || undefined}
    >
      {frameMode === 'polaroid' && <span className="v5-collage__paper" aria-hidden="true" />}
      <img style={photoStyleFor(tile)} src={tile.photo.originalSrc || tile.photo.previewSrc} alt="" />
      <CardDecoration index={index} enabled={decorationEnabled} />
    </figure>
  )
}

export default function V5FocusViewer({ layout, initialTileId, boardRect, frameMode, decorationEnabled, autoPlacements, onClose }) {
  const initialTile = useMemo(() => layout.find((tile) => tile.id === initialTileId) || layout[0], [initialTileId, layout])
  const [selectedId, setSelectedId] = useState(initialTile.id)
  const [camera, setCamera] = useState(openingCamera)
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [exportingId, setExportingId] = useState(null)
  const [viewport, setViewport] = useState(viewportSize)
  // 手机 Safari 对带 scale 的合成层常停留在动画起点的光栅化，整板放大后所有照片都发软。
  // 选中照片与压在它上面的遮挡者以「当前镜头下的像素矩形」独立渲染（不进缩放层），
  // 用与整板相同的时长/缓动过渡，从点击那一帧起就跟随镜头运动，任何时刻都保持原生分辨率。
  const frame = useMemo(() => focusFrameFor(viewport), [viewport.height, viewport.width])

  useEffect(() => {
    const onResize = () => setViewport(viewportSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    const scale = focusScaleFor(initialTile, boardRect, frame)
    const animationFrame = requestAnimationFrame(() => {
      setVisible(true)
      setCamera(focusCameraFor(initialTile, boardRect, frame, scale))
    })
    const onKeyDown = (event) => { if (event.key === 'Escape') closeViewer() }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    const tile = layout.find((item) => item.id === selectedId) || initialTile
    const scale = focusScaleFor(tile, boardRect, frame)
    setCamera(focusCameraFor(tile, boardRect, frame, scale))
  }, [frame.height, frame.width])

  const closeViewer = () => {
    if (leaving) return
    setLeaving(true)
    setVisible(false)
    // 高清/幽灵层跟随镜头一起缩回原位，过渡结束后再卸载整个查看层。
    setCamera(openingCamera())
    window.setTimeout(onClose, TRANSITION_MS)
  }

  const moveToTile = (tile) => {
    if (leaving) return
    // 再点当前选中的照片 = 返回完整拼贴；点其他照片只移动镜头。
    if (tile.id === selectedId) {
      closeViewer()
      return
    }
    // 浏览其他照片时保持同一镜头倍率，只平移整张高清拼贴。
    setSelectedId(tile.id)
    setCamera((current) => focusCameraFor(tile, boardRect, frame, current.scale))
  }

  const exportCurrentView = async (tier) => {
    if (exportingId) return
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

  const hiresTile = layout.find((tile) => tile.id === selectedId)
  // 真正压在选中照片之上的邻居：高清层会把它们盖掉，所以各出一份裁剪到
  // 选中照片范围内的高清幽灵拷贝，恢复「有东西盖在上面」的读感。
  const occluders = findOccluders(layout, hiresTile)

  return (
    <section className={`v5-focus ${visible ? 'is-visible' : ''} ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="高清拼贴查看">
      <div className="v5-focus__viewport">
        <div className="v5-focus__artboard" style={{ left: `${frame.left}px`, top: `${frame.top}px`, width: `${frame.width}px`, height: `${frame.height}px` }}>
          <div
            className="v5-collage__board v5-focus__board"
            style={{ left: `${boardRect.left - frame.left}px`, top: `${boardRect.top - frame.top}px`, width: `${boardRect.width}px`, transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}
          >
            <BoardDecorations enabled={decorationEnabled} autoPlacements={autoPlacements} />
            {layout.map((tile, index) => (
              <figure
                key={tile.id}
                className={`v5-collage__photo v5-collage__photo--${frameMode} v5-focus__photo ${tile.id === selectedId ? 'is-selected' : ''}`}
                style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.width}%`, height: `${tile.height}%`, zIndex: tile.z, transform: `rotate(${tile.rotate}deg)` }}
                onClick={() => moveToTile(tile)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    moveToTile(tile)
                  }
                }}
              >
                {frameMode === 'polaroid' && <span className="v5-collage__paper" aria-hidden="true" />}
                <img style={photoStyleFor(tile)} src={tile.photo.originalSrc || tile.photo.previewSrc} alt={`查看第 ${index + 1} 张照片`} />
                <CardDecoration index={index} enabled={decorationEnabled} />
              </figure>
            ))}
          </div>
          {hiresTile && (
            <FocusCard
              tile={hiresTile}
              index={layout.indexOf(hiresTile)}
              frameMode={frameMode}
              decorationEnabled={decorationEnabled}
              className="v5-focus__hires"
              style={overlayRectFor(hiresTile, boardRect, frame, camera)}
              onClick={closeViewer}
            />
          )}
          {hiresTile && occluders.map((tile) => (
            <FocusCard
              key={`ghost-${tile.id}`}
              tile={tile}
              index={layout.indexOf(tile)}
              frameMode={frameMode}
              decorationEnabled={decorationEnabled}
              className="v5-focus__ghost"
              style={{
                ...overlayRectFor(tile, boardRect, frame, camera),
                clipPath: occluderClipPath(hiresTile, tile),
                opacity: OCCLUDER_ALPHA,
              }}
              ariaHidden
            />
          ))}
        </div>
        <p className="v5-focus__frame-label" style={{ left: `${frame.left}px`, top: `${frame.top}px` }} aria-hidden="true">导出范围 · 4:3</p>
      </div>
      <div className="v5-focus__exports">
        {EXPORT_TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            className="v5-focus__export"
            title={tier.note}
            disabled={Boolean(exportingId)}
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
