import { useEffect, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { BOARDS } from './CollageMastersPrototype.jsx'
import { worksStore } from '../lib/worksStore.js'
import './CollageMastersPrototype.css'
import './CollageFlowPrototype.css'
import './CollageCollectionsPrototype.css'

// PROTOTYPE — tests whether choosing by a large, faithful master-board preview
// makes the collage flow clearer. Completed pages are saved only in this browser.

const CATEGORIES = [
  { id: 'grid', name: '整齐拼图', note: '照片紧贴成一个完整构图', coverId: 'neat-grid', templates: [{ id: 'neat-grid', name: '紧凑拼图', count: 7 }, { id: 'neat-grow', name: '向外生长', count: 10 }] },
  { id: 'editorial', name: '杂志散点', note: '照片围绕标题形成阅读节奏', coverId: 'editorial-scatter', templates: [{ id: 'editorial-scatter', name: '中心标题式', count: 8 }, { id: 'editorial-cover', name: '封面式', count: 10 }] },
  { id: 'prints', name: '相纸叠放', note: '像一叠被留下来的相纸', coverId: 'print-stack', templates: [{ id: 'print-wall', name: '整齐相纸墙', count: 9 }, { id: 'print-stack', name: '随手叠放', count: 6 }] },
  { id: 'torn', name: '撕纸剪贴', note: '像手账里拼出来的一页', coverId: 'torn-paper', templates: [{ id: 'torn-paper', name: '纸上瞬间', count: 6 }] },
]

const TONES = ['sunset', 'lake', 'street', 'cloud', 'forest', 'night']

function BackBar({ onBack, rightLabel, onRight, backLabel = '返回', brandOnly = false }) {
  return <header className={`flow-bar ${brandOnly ? 'flow-bar--brand' : ''}`}>{onBack ? <button type="button" onClick={onBack}>← {backLabel}</button> : <span>ALBUMMM</span>}{!brandOnly && (rightLabel ? <button type="button" onClick={onRight}>{rightLabel}</button> : <span className="flow-bar__quiet">照片拼贴</span>)}</header>
}

function DockIcon({ type }) {
  return <span className={`flow-dock__icon flow-dock__icon--${type}`} aria-hidden="true"><i /><i /><i /><i /></span>
}

function AppDock({ active, onNavigate }) {
  return <nav className="flow-dock" aria-label="主导航"><button type="button" className={active === 'home' ? 'is-active' : ''} aria-current={active === 'home' ? 'page' : undefined} onClick={() => onNavigate('home')}><DockIcon type="make" /><span>制作</span></button><button type="button" className={active === 'library' ? 'is-active' : ''} aria-current={active === 'library' ? 'page' : undefined} onClick={() => onNavigate('library')}><DockIcon type="works" /><span>作品</span></button></nav>
}

function BoardPreview({ boardId, className = '', photos = [], boardRef }) {
  const Board = BOARDS[boardId]
  return <div ref={boardRef} className={`flow-board-preview ${className}`}><Board miniature photos={photos} /></div>
}

function stackStyleFor(boardId) {
  if (boardId.startsWith('neat-')) return 'neat'
  if (boardId.startsWith('editorial-')) return 'editorial'
  if (boardId.startsWith('print-')) return 'prints'
  return 'torn'
}

function StackedPhotos({ boardId, photos = [] }) {
  const stackStyle = stackStyleFor(boardId)
  return <div className={`flow-stack flow-stack--${stackStyle}`} aria-hidden="true">{TONES.map((tone, index) => <i key={tone} className={`flow-stack__photo flow-stack__photo--${index + 1} flow-photo__image--${tone}`} style={photos[index] ? { backgroundImage: `url("${photos[index]}")` } : undefined} />)}</div>
}

function Artwork({ boardId, photos = [], stacked = false, interactive = false, onPointerDown, onPointerUp, onPointerCancel, boardRef }) {
  return <section className={`flow-art ${stacked ? 'flow-art--stacked' : ''} ${interactive ? 'flow-art--interactive' : ''}`} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>{stacked ? <StackedPhotos boardId={boardId} photos={photos} /> : <BoardPreview boardId={boardId} photos={photos} boardRef={boardRef} className="flow-board-preview--art" />}</section>
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function DeckCarousel({ category, activeTemplateIndex, onCycle, onChoose, showHint }) {
  const pointerStartX = useRef(null)
  const handledPointer = useRef(false)
  const [dragOffset, setDragOffset] = useState(0)
  const template = category.templates[activeTemplateIndex]

  const finishPointer = (event) => {
    if (pointerStartX.current === null) return
    const distance = event.clientX - pointerStartX.current
    pointerStartX.current = null
    handledPointer.current = true
    setDragOffset(0)
    if (Math.abs(distance) >= 28 && category.templates.length > 1) {
      onCycle(distance < 0 ? 1 : -1)
      return
    }
    onChoose(category.id, activeTemplateIndex)
  }

  const positionFor = (templateIndex) => (templateIndex - activeTemplateIndex + category.templates.length) % category.templates.length
  const sheetStyle = (templateIndex) => {
    const position = positionFor(templateIndex)
    if (position === 0) return { transform: `translateX(${dragOffset}px) rotate(-1.2deg)` }
    if (position === 1) return { transform: `translateX(${dragOffset * -0.08}px) rotate(1deg) scale(${1 + Math.abs(dragOffset) / 1000})` }
    return undefined
  }

  return <button type="button" className={`flow-deck-card ${dragOffset ? 'flow-deck-card--dragging' : ''}`} aria-label={`${category.name}，${template.name}；${category.templates.length > 1 ? `${category.templates.length} 个版式可左右轻扫切换；` : ''}轻点使用`} onPointerDown={(event) => { pointerStartX.current = event.clientX; event.currentTarget.setPointerCapture?.(event.pointerId) }} onPointerMove={(event) => { if (pointerStartX.current === null) return; setDragOffset(Math.max(-34, Math.min(34, event.clientX - pointerStartX.current))) }} onPointerUp={finishPointer} onPointerCancel={() => { pointerStartX.current = null; setDragOffset(0) }} onClick={() => { if (handledPointer.current) { handledPointer.current = false; return } onChoose(category.id, activeTemplateIndex) }} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); onCycle(1) } if (event.key === 'ArrowLeft') { event.preventDefault(); onCycle(-1) } }}>
    <span className={`flow-deck-card__stack flow-deck-card__stack--${category.templates.length} ${showHint && category.templates.length > 1 ? 'flow-deck-card__stack--hint' : ''}`} aria-hidden="true">{category.templates.slice(0, 3).map((templateItem, templateIndex) => <BoardPreview key={templateItem.id} boardId={templateItem.id} className={`flow-deck-card__sheet flow-deck-card__sheet--${positionFor(templateIndex)}`} style={sheetStyle(templateIndex)} />)}</span>
    <span className="flow-deck-card__copy"><b>{category.name}</b><small>{template.name}</small></span>
  </button>
}

export default function CollageFlowPrototype() {
  const [screen, setScreen] = useState('home')
  const [categoryId, setCategoryId] = useState('prints')
  const [templateIndex, setTemplateIndex] = useState(1)
  const [photos, setPhotos] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [works, setWorks] = useState([])
  const [activeWork, setActiveWork] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showWorkMenu, setShowWorkMenu] = useState(false)
  const [undoWork, setUndoWork] = useState(null)
  const [deckIndexes, setDeckIndexes] = useState({})
  const [showDeckHint, setShowDeckHint] = useState(true)
  const revealStartY = useRef(null)
  const revealTimer = useRef(null)
  const boardRef = useRef(null)
  const fileInputRef = useRef(null)
  const undoTimer = useRef(null)

  const category = CATEGORIES.find((item) => item.id === categoryId)
  const template = category.templates[templateIndex] || category.templates[0]

  const chooseTemplate = (nextCategoryId, nextTemplateIndex) => {
    setCategoryId(nextCategoryId)
    setTemplateIndex(nextTemplateIndex)
    setPhotos([])
    setActiveWork(null)
    setScreen('upload')
  }
  const cycleDeck = (categoryId, direction) => {
    const selectedCategory = CATEGORIES.find((item) => item.id === categoryId)
    setDeckIndexes((current) => ({ ...current, [categoryId]: ((current[categoryId] || 0) + direction + selectedCategory.templates.length) % selectedCategory.templates.length }))
  }
  const beginReveal = () => { setExpanded(false); setScreen('reveal') }
  const finish = async () => {
    if (!boardRef.current || isSaving) return
    setIsSaving(true)
    try {
      const image = await toBlob(boardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: '#fdfcf9' })
      if (!image) throw new Error('图片生成失败')
      const work = { id: Date.now(), category: categoryId, template: template.name, boardId: template.id, createdAt: new Date().toISOString(), image }
      await worksStore.put(work)
      const visibleWork = { ...work, previewUrl: URL.createObjectURL(image) }
      setWorks((previous) => [visibleWork, ...previous])
      setActiveWork(visibleWork)
      setScreen('result')
    } catch (error) {
      window.alert('这张拼贴页暂时没有生成成功，请再试一次。')
      setExpanded(false)
      setScreen('reveal')
    } finally {
      setIsSaving(false)
    }
  }
  const completeReveal = () => { if (expanded) return; setExpanded(true); revealTimer.current = window.setTimeout(finish, 680) }
  const leaveReveal = () => { window.clearTimeout(revealTimer.current); revealTimer.current = null; setExpanded(false); setScreen('upload') }
  const beginDragReveal = (event) => { if (expanded) return; revealStartY.current = event.clientY; event.currentTarget.setPointerCapture?.(event.pointerId) }
  const finishDragReveal = (event) => { if (revealStartY.current === null) return; const upwardDistance = revealStartY.current - event.clientY; revealStartY.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); if (upwardDistance >= 36) completeReveal() }

  useEffect(() => {
    if (!showDeckHint) return undefined
    const timer = window.setTimeout(() => setShowDeckHint(false), 2200)
    return () => window.clearTimeout(timer)
  }, [showDeckHint])

  useEffect(() => {
    let cancelled = false
    worksStore.list().then((storedWorks) => {
      if (cancelled) return
      setWorks(storedWorks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((work) => ({ ...work, previewUrl: URL.createObjectURL(work.image) })))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    window.clearTimeout(revealTimer.current)
    window.clearTimeout(undoTimer.current)
  }, [])

  const addPhotos = async (event) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/')).slice(0, template.count)
    if (!files.length) return
    const nextPhotos = await Promise.all(files.map(readPhoto))
    setPhotos(nextPhotos)
    event.target.value = ''
  }
  const downloadWork = (work) => {
    if (!work?.image) return
    const url = URL.createObjectURL(work.image)
    const link = document.createElement('a')
    link.href = url
    link.download = `albummm-${work.template}.png`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 300)
  }
  const removeActiveWork = async () => {
    if (!activeWork) return
    const removed = activeWork
    setShowWorkMenu(false)
    setWorks((previous) => previous.filter((work) => work.id !== removed.id))
    setActiveWork(null)
    setScreen('library')
    await worksStore.remove(removed.id)
    setUndoWork(removed)
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndoWork(null), 5000)
  }
  const undoRemove = async () => {
    if (!undoWork) return
    await worksStore.put(undoWork)
    setWorks((previous) => [undoWork, ...previous])
    setUndoWork(null)
    window.clearTimeout(undoTimer.current)
  }

  return (
    <main className="flow-prototype">
      <section className="flow-phone">
        {screen === 'home' && <>
          <section className="flow-home-intro flow-home-intro--compact"><h1>把照片，摊成一页。</h1><span>轻扫纸堆切换版式，轻点当前页开始。</span></section>
          <section className="flow-deck-list" aria-label="选择拼贴类型">{CATEGORIES.map((item) => <DeckCarousel key={item.id} category={item} activeTemplateIndex={deckIndexes[item.id] || 0} onCycle={(direction) => cycleDeck(item.id, direction)} onChoose={chooseTemplate} showHint={showDeckHint} />)}</section>
        </>}

        {screen === 'upload' && <>
          <BackBar onBack={() => setScreen('home')} />
          <section className="flow-page-title"><p>{category.name} · {template.name}</p><h1>添加 {template.count} 张照片</h1><span>第一张会成为主图。想突出哪张，就先添加它。</span></section>
          <section className="flow-upload-grid">{Array.from({ length: template.count }, (_, index) => <span key={index} className={`flow-upload-slot ${photos[index] ? 'flow-upload-slot--ready' : ''}`}>{photos[index] ? <img src={photos[index]} alt={`已选照片 ${index + 1}`} /> : <b>+</b>}<small>{index === 0 ? '主图 / 01' : String(index + 1).padStart(2, '0')}</small></span>)}</section>
          <input ref={fileInputRef} className="flow-file-input" type="file" accept="image/*" multiple onChange={addPhotos} />
          {photos.length < template.count ? <button type="button" className="flow-primary flow-primary--page" onClick={() => fileInputRef.current?.click()}>{photos.length ? `还差 ${template.count - photos.length} 张照片` : `选择 ${template.count} 张照片`}</button> : <button type="button" className="flow-primary flow-primary--page" onClick={beginReveal}>开始排版</button>}
          <p className="flow-prototype-note">照片只用于制作这张拼贴页，成品会保存在这台设备的“作品”里。</p>
        </>}

        {screen === 'reveal' && <>
          <BackBar onBack={leaveReveal} />
          <section className="flow-reveal-copy"><p>准备好了</p><h1>{expanded ? '照片已归位' : '向上展开照片'}</h1></section>
          <Artwork boardId={template.id} photos={photos} boardRef={boardRef} stacked={!expanded} interactive={!expanded} onPointerDown={beginDragReveal} onPointerUp={finishDragReveal} onPointerCancel={() => { revealStartY.current = null }} />
          {!expanded && <button type="button" className="flow-gesture" onClick={completeReveal}><b>↑</b>向上拖动照片堆</button>}
          {isSaving && <p className="flow-saving">正在收好这张拼贴页…</p>}
        </>}

        {screen === 'result' && <>
          <BackBar onBack={() => setScreen('home')} backLabel="完成" rightLabel={activeWork ? '···' : '作品'} onRight={() => activeWork ? setShowWorkMenu(true) : setScreen('library')} />
          <section className="flow-result-copy"><span>已收进作品</span><h1>{activeWork?.template || template.name}</h1></section>
          {activeWork?.previewUrl ? <section className="flow-exported-art"><img src={activeWork.previewUrl} alt={`${activeWork.template} 成品预览`} /></section> : <Artwork boardId={template.id} photos={photos} />}
          <section className="flow-result-actions"><button type="button" className="flow-primary" onClick={() => downloadWork(activeWork)}>下载图片</button><button type="button" onClick={() => setScreen('library')}>查看作品</button></section>
          {showWorkMenu && <section className="flow-work-menu" role="dialog" aria-label="作品操作"><button type="button" onClick={() => setShowWorkMenu(false)}>取消</button><button type="button" onClick={removeActiveWork}>删除这张作品</button></section>}
        </>}

        {screen === 'library' && <>
          <section className="flow-page-title flow-page-title--library"><p>YOUR PAGES</p><h1>作品</h1><span>{works.length ? `已制作 ${works.length} 张拼贴页` : '第一张拼贴页会从这里开始'}</span></section>
          {works.length ? <section className={`flow-library-grid ${works.length === 1 ? 'flow-library-grid--single' : ''}`}>{works.map((work) => <button type="button" key={work.id} onClick={() => { setActiveWork(work); setScreen('result') }}><span className="flow-work-thumb"><img src={work.previewUrl} alt={`${work.template} 成品缩略图`} /></span><span>{work.template}<small>{new Date(work.createdAt).toLocaleDateString('zh-CN')}</small></span></button>)}</section> : <section className="flow-empty"><b>+</b><span>还没有作品<br />先做一张拼贴页吧</span><button type="button" onClick={() => setScreen('home')}>开始制作</button></section>}
        </>}
        {(screen === 'home' || screen === 'library') && <AppDock active={screen} onNavigate={setScreen} />}
        {undoWork && <button type="button" className="flow-undo" onClick={undoRemove}>已删除　<b>撤销</b></button>}
      </section>
    </main>
  )
}
