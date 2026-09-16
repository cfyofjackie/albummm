import { useMemo, useRef, useState } from 'react'
import './CollageInteractionPrototype.css'

// PROTOTYPE — Does “a stack of photos opens into a collage” feel like the right ritual?
// Run `npm run dev`, then open `/?prototype=collage-interaction`.

const STAGES = [
  { id: 'stack', label: '01', name: '照片堆' },
  { id: 'midway', label: '02', name: '展开中' },
  { id: 'expanded', label: '03', name: '完成页' },
]

const PHOTOS = [
  { id: 1, tone: 'sunset' },
  { id: 2, tone: 'lake' },
  { id: 3, tone: 'street' },
  { id: 4, tone: 'cloud' },
  { id: 5, tone: 'forest' },
  { id: 6, tone: 'night' },
]

function StageSwitcher({ stage, onChange }) {
  const index = STAGES.findIndex((item) => item.id === stage)
  const previous = STAGES[(index - 1 + STAGES.length) % STAGES.length]
  const next = STAGES[(index + 1) % STAGES.length]
  const current = STAGES[index]

  return (
    <nav className="interaction-switcher" aria-label="切换交互状态">
      <button type="button" onClick={() => onChange(previous.id)} aria-label="上一个状态">←</button>
      <span>{current.label} · {current.name}</span>
      <button type="button" onClick={() => onChange(next.id)} aria-label="下一个状态">→</button>
    </nav>
  )
}

export default function CollageInteractionPrototype() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const initialStage = STAGES.some((item) => item.id === params.get('stage'))
    ? params.get('stage')
    : 'stack'
  const [stage, setStage] = useState(initialStage)
  const startY = useRef(null)

  const changeStage = (nextStage) => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set('prototype', 'collage-interaction')
    nextParams.set('stage', nextStage)
    window.history.replaceState(null, '', `?${nextParams.toString()}`)
    setStage(nextStage)
  }

  const onPointerDown = (event) => {
    startY.current = event.clientY
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event) => {
    if (startY.current == null) return
    if (startY.current - event.clientY > 14 && stage === 'stack') changeStage('midway')
  }

  const onPointerUp = (event) => {
    if (startY.current == null) return
    const distance = startY.current - event.clientY
    startY.current = null
    changeStage(distance > 34 ? 'expanded' : 'stack')
  }

  const isExpanded = stage === 'expanded'

  return (
    <main className="interaction-prototype">
      <section className="interaction-app">
        <header className="interaction-header">
          <span>ALBUMMM</span>
          <p>随手相纸叠放 · 6 张</p>
        </header>

        <section
          className={`interaction-sheet interaction-sheet--${stage}`}
          aria-label="相纸展开预览"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            startY.current = null
            changeStage('stack')
          }}
        >
          {PHOTOS.map((photo) => (
            <article key={photo.id} className={`instant-card instant-card--${photo.id}`}>
              <span className={`instant-card__image instant-card__image--${photo.tone}`} />
            </article>
          ))}

          {!isExpanded && (
            <button
              type="button"
              className="interaction-drag-hint"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                changeStage('expanded')
              }}
            >
              <span>↑</span>
              <small>向上拖动照片堆</small>
            </button>
          )}

          {isExpanded && <span className="interaction-complete">YOUR LITTLE ARCHIVE</span>}
        </section>

        <footer className="interaction-footer">
          {isExpanded ? (
            <button type="button" onClick={() => changeStage('stack')}>再看一次</button>
          ) : (
            <p>所有照片从一开始就带着相纸白边</p>
          )}
        </footer>
      </section>

      <aside className="interaction-note">
        <span>原型状态</span>
        <p>{stage === 'stack' ? '照片带着相纸边框等待展开。' : stage === 'midway' ? '先错开，再进入各自的预设位置。' : '位置、旋转与层级已经定格；不会重新随机洗牌。'}</p>
      </aside>

      <StageSwitcher stage={stage} onChange={changeStage} />
    </main>
  )
}
