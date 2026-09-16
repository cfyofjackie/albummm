import { useRef, useState } from 'react'
import { BOARDS } from './CollageMastersPrototype.jsx'
import './CollageMastersPrototype.css'
import './CollageFlowPrototype.css'

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

export default function CollageFlowPrototype() {
  const [screen, setScreen] = useState('home')
  const [categoryId, setCategoryId] = useState('prints')
  const [templateIndex, setTemplateIndex] = useState(1)
  const [photosReady, setPhotosReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [works, setWorks] = useState([])
  const [downloaded, setDownloaded] = useState(false)
  const revealStartY = useRef(null)
  const revealTimer = useRef(null)

  const category = CATEGORIES.find((item) => item.id === categoryId)
  const template = category.templates[templateIndex] || category.templates[0]

  const chooseCategory = (id) => { setCategoryId(id); setTemplateIndex(id === 'prints' ? 1 : 0); setScreen('templates') }
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
          <section className="flow-home-intro"><p>MAKE A PAGE</p><h1>把照片<br />摊成一页。</h1><span>先选你想留下来的感觉。</span></section>
          <section className="flow-category-list" aria-label="选择拼贴类型">{CATEGORIES.map((item) => <button key={item.id} type="button" className="flow-category" onClick={() => chooseCategory(item.id)}><BoardPreview boardId={item.coverId} className="flow-category__preview" /><span><b>{item.name}</b><small>{item.note}</small><em>查看版式 →</em></span></button>)}</section>
        </>}

        {screen === 'templates' && <>
          <BackBar onBack={() => setScreen('home')} rightLabel="我的" onRight={() => setScreen('library')} />
          <section className="flow-page-title"><p>{category.name.toUpperCase()}</p><h1>选一张你想要的成品</h1><span>这一步选择的是完整版式；照片会自动放入对应位置。</span></section>
          <section className="flow-template-list">{category.templates.map((item, index) => <button key={item.id} type="button" className={`flow-template ${templateIndex === index ? 'flow-template--selected' : ''}`} onClick={() => setTemplateIndex(index)}><BoardPreview boardId={item.id} className="flow-template__preview" /><span><b>{item.name}</b><small>{item.count} 张照片 · 自动排版</small></span><i>{templateIndex === index ? '已选择' : '点选此版式'}</i></button>)}</section>
          <button type="button" className="flow-primary flow-primary--page" onClick={() => setScreen('upload')}>用这个版式</button>
        </>}

        {screen === 'upload' && <>
          <BackBar onBack={() => setScreen('templates')} rightLabel="我的" onRight={() => setScreen('library')} />
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
      <aside className="flow-state"><span>原型状态</span><p>{screen === 'home' ? '首页用大卡片先让用户看见成品。' : screen === 'templates' ? '二级页只比较真实母板。' : screen === 'upload' ? '第一张照片默认是主图。' : screen === 'reveal' ? '上滑完成后直接进入成品。' : screen === 'result' ? '作品自动保存，下载是唯一主操作。' : '“我的”按设备本地保存作品。'}</p></aside>
    </main>
  )
}
