import { useEffect, useMemo, useState } from 'react'
import { BoardDecorations, CardDecoration } from './V5Decorations.jsx'
import { EXPORT_TIERS, downloadBlob, exportFocusImage } from './focusExport.js'
import { exportTransformFor, focusCameraFor, focusFrameFor, focusScaleFor, openingCamera } from './focusGeometry.js'

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

export default function V5FocusViewer({ layout, initialTileId, boardRect, frameMode, decorationEnabled, autoPlacements, onClose }) {
  const initialTile = useMemo(() => layout.find((tile) => tile.id === initialTileId) || layout[0], [initialTileId, layout])
  const [selectedId, setSelectedId] = useState(initialTile.id)
  const [camera, setCamera] = useState(openingCamera)
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [exportingId, setExportingId] = useState(null)
  const [viewport, setViewport] = useState(viewportSize)
  // 手机 Safari 对带 scale 的合成层常停留在动画起点的光栅化，整板放大后所有照片都发软。
  // 动画结束后把选中的那张按最终屏幕尺寸、不经过 CSS scale 单独渲染一层（高清层），
  // 点其他照片平移时先收回、动画结束再淡入到新选中的位置；周围拼贴维持整板渲染。
  const [hiresTileId, setHiresTileId] = useState(null)
  const frame = useMemo(() => focusFrameFor(viewport), [viewport.height, viewport.width])

  useEffect(() => {
    const onResize = () => setViewport(viewportSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    setHiresTileId(null)
    const timer = window.setTimeout(() => setHiresTileId(selectedId), TRANSITION_MS + 60)
    return () => window.clearTimeout(timer)
  }, [selectedId, frame.width, frame.height])
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
    setHiresTileId(null)
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
      const blob = await exportFocusImage({ layout, frameMode, decorationEnabled, autoPlacements, boardRect, frame, camera, tier })
      downloadBlob(blob, `albummm-v5-focus-${tier.width}x${tier.height}.${tier.ext}`)
    } catch (error) {
      console.error('V5 focus export failed', error?.type, error?.target?.currentSrc || error?.target?.src || error)
    } finally {
      setExportingId(null)
    }
  }

  const hiresTile = hiresTileId ? layout.find((tile) => tile.id === hiresTileId) : null
  // 与整板缩放层、导出画布共用同一套坐标换算（unit = 每百分比多少 px），保证逐像素对齐。
  const hiresTransform = hiresTile ? exportTransformFor(boardRect, frame, camera, { width: frame.width, height: frame.height }) : null

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
          {hiresTile && hiresTransform && (
            <figure
              className={`v5-collage__photo v5-collage__photo--${frameMode} v5-focus__hires`}
              style={{
                left: `${hiresTransform.originX + hiresTile.x * hiresTransform.unitX}px`,
                top: `${hiresTransform.originY + hiresTile.y * hiresTransform.unitY}px`,
                width: `${hiresTile.width * hiresTransform.unitX}px`,
                height: `${hiresTile.height * hiresTransform.unitY}px`,
                transform: `rotate(${hiresTile.rotate}deg)`,
              }}
              onClick={closeViewer}
            >
              {frameMode === 'polaroid' && <span className="v5-collage__paper" aria-hidden="true" />}
              <img style={photoStyleFor(hiresTile)} src={hiresTile.photo.originalSrc || hiresTile.photo.previewSrc} alt="" />
              <CardDecoration index={layout.indexOf(hiresTile)} enabled={decorationEnabled} />
            </figure>
          )}
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
