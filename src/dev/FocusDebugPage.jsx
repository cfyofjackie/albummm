import { useEffect, useRef, useState } from 'react'
import { listWorks } from '../shared/works.js'
import V5CollagePrototype from '../v5-collage/V5CollagePrototype.jsx'
import './focusDebug.css'

// 开发者调试页（#/dev/focus，仅 dev 构建注册）。
// 页面主体就是真正的 V5CollagePrototype——呈现与 #/collage 完全一致；
// 调试面板浮在其上，只负责两件事：
//   1. 把倍率系数经 focusScaleFactor 传入查看层（默认 1，正式页面不传）；
//   2. 经 onFocusInfo 读取当前照片/倍率拆解，供对比记录。
// 数据源切换通过 hash 的 ?work= 参数重新挂载内嵌页面，与正式入口同一条加载路径。
// 面板的比例/照片快捷按钮也是直接点击内嵌页面的真实控件，保证同一条操作路径。

const STORAGE_KEY = 'albummm-dev-focus'

export default function FocusDebugPage() {
  const embedRef = useRef(null)
  const [sourceId, setSourceId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (saved.sourceId) return saved.sourceId
    } catch { /* 忽略损坏的本地设置 */ }
    return new URLSearchParams(window.location.hash.split('?')[1] || '').get('work') || 'demo'
  })
  const [sources, setSources] = useState([])
  const [factor, setFactor] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (Number.isFinite(saved.factor) && saved.factor > 0) return saved.factor
    } catch { /* 忽略损坏的本地设置 */ }
    return 1
  })
  const [info, setInfo] = useState(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ factor, sourceId }))
  }, [factor, sourceId])

  useEffect(() => {
    let active = true
    listWorks().then((works) => {
      if (!active) return
      setSources(works.filter((work) => work.type === 'collage').map((work) => ({ id: work.id, label: work.title || '未命名拼贴' })))
    }).catch(() => {})
    return () => { active = false }
  }, [])

  // 数据源切换：改 hash 参数并重挂内嵌页面（走与正式入口完全相同的加载路径）
  const switchSource = (id) => {
    setSourceId(id)
    const hash = id === 'demo' ? '#/dev/focus' : `#/dev/focus?work=${encodeURIComponent(id)}`
    window.history.replaceState(null, '', hash)
  }

  // 面板快捷操作：直接点击内嵌页面上的真实控件，保证与手动操作完全同路径
  const clickInEmbed = (selector, matcher) => {
    const root = embedRef.current
    if (!root) return false
    const el = [...root.querySelectorAll(selector)].find(matcher)
    if (!el) return false
    el.click()
    return true
  }
  const setRatio = (label) => clickInEmbed('.v5-collage__frame-toggle button', (b) => b.textContent === label)
  const pickPhoto = (index) => {
    const root = embedRef.current
    if (!root) return
    const inViewer = [...root.querySelectorAll('.v5-focus__photo')].find((el) => {
      return el.getAttribute('aria-label') === `查看第 ${index + 1} 张照片`
    })
    if (inViewer) { inViewer.click(); return true }
    const tile = [...root.querySelectorAll('.v5-collage__photo')][index]
    if (tile) { tile.click(); return true }
    return false
  }
  const activeRatioLabel = () => embedRef.current?.querySelector('.v5-collage__frame-toggle .is-active')?.textContent || ''

  const updateFactor = (value) => {
    const next = Math.max(0.5, Math.min(4, Math.round((Number(value) || 1) * 100) / 100))
    setFactor(next)
  }
  const resetFactor = () => setFactor(1)
  const copyParams = async () => {
    const text = `boardRatio=${activeRatioLabel()} photo=${(info?.photoIndex ?? 0) + 1}/${info?.total ?? 10} factor=${factor.toFixed(2)} groupSafe=${info?.groupSafe?.toFixed(2) ?? ''}`
    try { await navigator.clipboard.writeText(text) } catch { /* 剪贴板不可用时忽略 */ }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="dev-focus-host">
      <div className="dev-focus-embed" ref={embedRef}>
        <V5CollagePrototype key={sourceId} focusScaleFactor={factor} onFocusInfo={setInfo} />
      </div>

      <button type="button" className="dev-focus__toggle" onClick={() => setPanelOpen((open) => !open)}>
        {panelOpen ? '收起面板' : '调试面板'}
      </button>
      {panelOpen && (
        <aside className="dev-focus__panel">
          <strong>放大倍率调试</strong>
          <label className="dev-focus__field">
            数据源
            <select value={sourceId} onChange={(event) => switchSource(event.target.value)}>
              <option value="demo">演示照片</option>
              {sources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>
          </label>
          <div className="dev-focus__row">
            <span>比例</span>
            <button type="button" onClick={() => setRatio('4:3 横版')}>4:3</button>
            <button type="button" onClick={() => setRatio('3:4 竖版')}>3:4</button>
          </div>
          <div className="dev-focus__row dev-focus__photos" role="group" aria-label="直接选择照片">
            <span>照片</span>
            {Array.from({ length: info?.total ?? 10 }, (_, index) => (
              <button
                key={index}
                type="button"
                className={info?.photoIndex === index ? 'is-active' : ''}
                onClick={() => pickPhoto(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="dev-focus__row">
            <label className="dev-focus__field">
              系数
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="4"
                value={factor}
                onChange={(event) => updateFactor(event.target.value)}
              />
            </label>
            <button type="button" onClick={resetFactor}>恢复默认</button>
            <button type="button" onClick={copyParams}>{copied ? '已复制' : '复制当前参数'}</button>
          </div>
          <dl>
            <dt>整组安全倍率</dt>
            <dd>{info?.groupSafe?.toFixed(2) ?? '…'}</dd>
            <dt>当前统一倍率</dt>
            <dd className={info?.exposedCount ? 'is-below-safe' : ''}>{info?.uniformScale?.toFixed(2) ?? '…'}</dd>
            <dt>露底照片</dt>
            <dd className={info?.exposedCount ? 'is-below-safe' : ''}>{info ? `${info.exposedCount} / ${info.total}` : '…'}</dd>
          </dl>
          {info?.breakdown ? (
            <>
              <dl>
                <dt>当前照片</dt>
                <dd>{info.photoIndex + 1} / {info.total}</dd>
                <dt>位置（中心）</dt>
                <dd>{info.breakdown.centerX.toFixed(1)} × {info.breakdown.centerY.toFixed(1)} px</dd>
                <dt>这张的安全倍率</dt>
                <dd>{info.breakdown.edgeScale.toFixed(2)}</dd>
                <dt>导出范围四边</dt>
                <dd className="dev-focus__edges">
                  {(['left', 'right', 'top', 'bottom']).map((side) => (
                    <span key={side} className={info.breakdown.edges[side] ? 'is-exposed' : ''}>
                      {side === 'left' ? '左' : side === 'right' ? '右' : side === 'top' ? '上' : '下'}
                      {info.breakdown.edges[side] ? '露' : '盖'}
                    </span>
                  ))}
                </dd>
              </dl>
              {(info?.exposedCount ?? 0) > 0 && (
                <p className="dev-focus__warn">系数低于 1：有 {info.exposedCount} 张照片的取景会露出画布底色。</p>
              )}
            </>
          ) : (
            <p className="dev-focus__hint">点画布上的照片打开查看层后，这里显示倍率拆解。</p>
          )}
        </aside>
      )}
    </div>
  )
}
