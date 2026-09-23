import { useEffect, useMemo, useState } from 'react'
import { BoardDecorations, CardDecoration } from './V5Decorations.jsx'
import { downloadBlob, exportFocusPng } from './focusExport.js'
import { focusCameraFor, focusFrameFor, focusScaleFor, openingCamera } from './focusGeometry.js'

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
  const [exporting, setExporting] = useState(false)
  const [viewport, setViewport] = useState(viewportSize)
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
    setCamera(openingCamera())
    window.setTimeout(onClose, TRANSITION_MS)
  }

  const moveToTile = (tile) => {
    if (leaving || tile.id === selectedId) return
    setSelectedId(tile.id)
    // 浏览其他照片时保持同一镜头倍率，只平移整张高清拼贴。
    setCamera((current) => focusCameraFor(tile, boardRect, frame, current.scale))
  }

  const exportCurrentView = async () => {
    if (exporting) return
    setExporting(true)
    try {
      // 与预览共用固定 4:3 成品框和同一份镜头坐标；外围窗口区域从不进入导出。
      const blob = await exportFocusPng({ layout, frameMode, decorationEnabled, autoPlacements, boardRect, frame, camera })
      downloadBlob(blob)
    } catch (error) {
      console.error('V5 focus export failed', error?.type, error?.target?.currentSrc || error?.target?.src || error)
    } finally {
      setExporting(false)
    }
  }

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
        </div>
        <p className="v5-focus__frame-label" style={{ left: `${frame.left}px`, top: `${frame.top}px` }} aria-hidden="true">导出范围 · 4:3</p>
      </div>
      <button type="button" className="v5-focus__export" onClick={exportCurrentView} disabled={exporting}>{exporting ? '正在导出…' : '导出 PNG'}</button>
      <button type="button" className="v5-focus__close" onClick={closeViewer} aria-label="返回完整拼贴">×</button>
      <p className="v5-focus__hint">点击周围照片可平滑移动过去 · Esc 返回</p>
    </section>
  )
}
