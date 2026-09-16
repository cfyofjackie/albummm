import { useRef, useState } from 'react'
import { BOARDS } from './CollageMastersPrototype.jsx'
import './CollageMastersPrototype.css'
import './CollageFlowPrototype.css'
import './CollageCollectionsPrototype.css'

// PROTOTYPE — tests whether choosing by a large, faithful master-board preview
// makes the collage flow clearer. It intentionally keeps all state in memory.

const CATEGORIES = [
  { id: 'grid', name: '整齐拼图', note: '照片紧贴成一个完整构图', coverId: 'neat-grid', templates: [{ id: 'neat-grid', name: '紧凑拼图', count: 7 }, { id: 'neat-grow', name: '向外生长', count: 10 }] },
  { id: 'editorial', name: '杂志散点', note: '照片围绕标题形成阅读节奏', coverId: 'editorial-scatter', templates: [{ id: 'editorial-scatter', name: '中心标题式', count: 8 }, { id: 'editorial-cover', name: '封面式', count: 10 }] },
  { id: 'prints', name: '相纸叠放', note: '像一叠被留下来的相纸', coverId: 'print-stack', templates: [{ id: 'print-wall', name: '整齐相纸墙', count: 9 }, { id: 'print-stack', name: '随手叠放', count: 6 }] },
  { id: 'torn', name: '撕纸剪贴', note: '像手账里拼出来的一页', coverId: 'torn-paper', templates: [{ id: 'torn-paper', name: '纸上瞬间', count: 6 }] },
]

const TONES = ['sunset', 'lake', 'street', 'cloud', 'forest', 'night']

function BackBar({ onBack, rightLabel, onRight }) {
  return <header className="flow-bar">{onBack ? <button type="button" onClick={onBack}>← 返回</button> : <span>ALBUMMM</span>}{rightLabel ? <button type="button" onClick={onRight}>{rightLabel}</button> : <span className="flow-bar__quiet">照片拼贴</span>}</header>
}

function BoardPreview({ boardId, className = '' }) {
  const Board = BOARDS[boardId]
  return <div className={`flow-board-preview ${className}`}><Board miniature /></div>
}

function StackedPhotos() {
  return <div className="flow-stack" aria-hidden="true">{TONES.map((tone, index) => <i key={tone} className={`flow-stack__photo flow-stack__photo--${index + 1} flow-photo__image--${tone}`} />)}</div>
}

function Artwork({ boardId, stacked = false, interactive = false, onPointerDown, onPointerUp, onPointerCancel }) {
  return <section className={`flow-art ${stacked ? 'flow-art--stacked' : ''} ${interactive ? 'flow-art--interactive' : ''}`} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>{stacked ? <StackedPhotos /> : <BoardPreview boardId={boardId} className="flow-board-preview--art" />}</section>
}

function TemplateRail({ category, onChoose }) {
  const drag = useRef(null)
  const suppressClick = useRef(false)
  const [dragging, setDragging] = useState(false)

  const startDrag = (event) => {
    drag.current = { startX: event.clientX, startScrollLeft: event.currentTarget.scrollLeft }
  }

  const moveDrag = (event) => {
    if (!drag.current) return
    const distance = event.clientX - drag.current.startX
    if (Math.abs(distance) > 5) {
      suppressClick.current = true
      setDragging(true)
      event.currentTarget.scrollLeft = drag.current.startScrollLeft - distance
    }
  }

  const stopDrag = (event) => {
    if (!drag.current) return
    window.setTimeout(() => {
      setDragging(false)
      suppressClick.current = false
    }, 0)
    drag.current = null
  }

  const suppressClickAfterDrag = (event) => {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
  }

  return <div className={`flow-template-rail ${dragging ? 'flow-template-rail--dragging' : ''}`} aria-label={`${category.name}模板`} onMouseDown={startDrag} onMouseMove={moveDrag} onMouseUp={stopDrag} onMouseLeave={stopDrag} onClickCapture={suppressClickAfterDrag}>{category.templates.map((templateItem, itemIndex) => <button key={templateItem.id} type="button" className="flow-home-template" onClick={() => onChoose(category.id, itemIndex)}><BoardPreview boardId={templateItem.id} className="flow-home-template__preview" /><span><b>{templateItem.name}</b><small>{templateItem.count} 张照片</small></span></button>)}</div>
}

function CollectionPreview({ category }) {
  return <span className={`flow-collection-preview flow-collection-preview--${category.templates.length}`} aria-hidden="true">
    {category.templates.slice(0, 3).map((templateItem, index) => <BoardPreview key={templateItem.id} boardId={templateItem.id} className={`flow-collection-preview__sheet flow-collection-preview__sheet--${index + 1}`} />)}
  </span>
}

function CollectionCard({ category, index, open, onToggle, onChoose }) {
  return <section className={`flow-collection ${open ? 'flow-collection--open' : ''}`}>
    <button type="button" className="flow-collection__summary" onClick={onToggle} aria-expanded={open}>
      <span className="flow-collection__number">{String(index + 1).padStart(2, '0')}</span>
      <span className="flow-collection__copy"><b>{category.name}</b><small>{category.note}</small><i>{category.templates.length} 个模板</i></span>
      <CollectionPreview category={category} />
      <span className="flow-collection__action">{open ? '收起 ↑' : '展开 ↓'}</span>
    </button>
    {open && <section className="flow-collection__detail"><header><span>选择一个版式</span><small>左右滑动浏览</small></header><TemplateRail category={category} onChoose={onChoose} /></section>}
  </section>
}

export default function CollageFlowPrototype() {
  const [screen, setScreen] = useState('home')
  const [categoryId, setCategoryId] = useState('prints')
  const [templateIndex, setTemplateIndex] = useState(1)
  const [photosReady, setPhotosReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [works, setWorks] = useState([])
  const [downloaded, setDownloaded] = useState(false)
  const [openCategoryId, setOpenCategoryId] = useState(null)
  const revealStartY = useRef(null)
  const revealTimer = useRef(null)

  const category = CATEGORIES.find((item) => item.id === categoryId)
  const template = category.templates[templateIndex] || category.templates[0]

  const chooseTemplate = (nextCategoryId, nextTemplateIndex) => {
    setCategoryId(nextCategoryId)
    setTemplateIndex(nextTemplateIndex)
    setPhotosReady(false)
    setScreen('upload')
  }
  const beginReveal = () => { setExpanded(false); setScreen('reveal') }
  const finish = () => { setWorks((previous) => previous.length ? previous : [{ id: Date.now(), category: categoryId, template: template.name, boardId: template.id }]); setScreen('result') }
  const completeReveal = () => { if (expanded) return; setExpanded(true); revealTimer.current = window.setTimeout(finish, 680) }
  const leaveReveal = () => { window.clearTimeout(revealTimer.current); revealTimer.current = null; setExpanded(false); setScreen('upload') }
  const beginDragReveal = (event) => { if (expanded) return; revealStartY.current = event.clientY; event.currentTarget.setPointerCapture?.(event.pointerId) }
  const finishDragReveal = (event) => { if (revealStartY.current === null) return; const upwardDistance = revealStartY.current - event.clientY; revealStartY.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); if (upwardDistance >= 36) completeReveal() }

  return (
    <main className="flow-prototype">
      <section className="flow-phone">
        {screen === 'home' && <>
          <BackBar rightLabel="我的" onRight={() => setScreen('library')} />
          <section className="flow-home-intro"><p>MAKE A PAGE</p><h1>把照片<br />摊成一页。</h1><span>先打开一种风格，再选择其中的版式。</span></section>
          <section className="flow-collection-list" aria-label="选择拼贴类型">{CATEGORIES.map((item, categoryIndex) => <CollectionCard key={item.id} category={item} index={categoryIndex} open={openCategoryId === item.id} onToggle={() => setOpenCategoryId((current) => current === item.id ? null : item.id)} onChoose={chooseTemplate} />)}</section>
        </>}

        {screen === 'upload' && <>
          <BackBar onBack={() => setScreen('home')} rightLabel="我的" onRight={() => setScreen('library')} />
          <section className="flow-page-title"><p>{category.name} · {template.name}</p><h1>添加 {template.count} 张照片</h1><span>第一张会成为主图。想突出哪张，就先添加它。</span></section>
          <section className="flow-upload-grid">{Array.from({ length: template.count }, (_, index) => <span key={index} className={`flow-upload-slot ${photosReady ? 'flow-upload-slot--ready' : ''}`}>{photosReady ? <i className={`flow-photo__image flow-photo__image--${TONES[index % TONES.length]}`} /> : <b>+</b>}<small>{index === 0 ? '主图 / 01' : String(index + 1).padStart(2, '0')}</small></span>)}</section>
          {!photosReady ? <button type="button" className="flow-primary flow-primary--page" onClick={() => setPhotosReady(true)}>添加 {template.count} 张示例照片</button> : <button type="button" className="flow-primary flow-primary--page" onClick={beginReveal}>开始排版</button>}
          <p className="flow-prototype-note">原型使用示例照片；正式版在这里打开系统相册。</p>
        </>}

        {screen === 'reveal' && <>
          <BackBar onBack={leaveReveal} />
          <section className="flow-reveal-copy"><p>准备好了</p><h1>{expanded ? '照片已归位' : '向上展开照片'}</h1></section>
          <Artwork boardId={template.id} stacked={!expanded} interactive={!expanded} onPointerDown={beginDragReveal} onPointerUp={finishDragReveal} onPointerCancel={() => { revealStartY.current = null }} />
          {!expanded && <button type="button" className="flow-gesture" onClick={completeReveal}><b>↑</b>向上拖动照片堆</button>}
        </>}

        {screen === 'result' && <>
          <BackBar onBack={() => setScreen('home')} rightLabel="我的" onRight={() => setScreen('library')} />
          <section className="flow-result-copy"><span>已自动存入我的</span><h1>{template.name}</h1></section><Artwork boardId={template.id} />
          <section className="flow-result-actions"><button type="button" className="flow-primary" onClick={() => setDownloaded(true)}>{downloaded ? '已下载图片' : '下载图片'}</button><button type="button" onClick={() => setScreen('library')}>查看我的</button></section>
        </>}

        {screen === 'library' && <>
          <BackBar onBack={() => setScreen('home')} />
          <section className="flow-page-title flow-page-title--library"><p>MY PAGES</p><h1>我的</h1><span>{works.length ? '作品仅保存于这台设备' : '你还没有作品'}</span></section>
          {works.length ? <section className="flow-library-grid">{works.map((work) => <button type="button" key={work.id} onClick={() => { setCategoryId(work.category); setScreen('result') }}><BoardPreview boardId={work.boardId} /><span>{work.template}<small>刚刚创建</small></span></button>)}</section> : <section className="flow-empty"><b>+ </b><span>第一张拼贴页<br />会出现在这里</span></section>}
        </>}
      </section>
      <aside className="flow-state"><span>原型状态</span><p>{screen === 'home' ? (openCategoryId ? '已展开一个风格收藏夹，可横滑选择其中模板。' : '首页以风格收藏夹呈现模板集合。') : screen === 'upload' ? '第一张照片默认是主图。' : screen === 'reveal' ? '上滑完成后直接进入成品。' : screen === 'result' ? '作品自动保存，下载是唯一主操作。' : '“我的”按设备本地保存作品。'}</p></aside>
    </main>
  )
}
