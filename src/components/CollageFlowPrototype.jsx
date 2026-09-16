import { useState } from 'react'
import './CollageFlowPrototype.css'

// PROTOTYPE — A phone-sized, end-to-end flow for making and keeping one collage.
// Open with `?prototype=collage-flow`. This is intentionally in-memory only.

const CATEGORIES = [
  { id: 'grid', name: '整齐拼图', note: '照片贴合成一个整体', templates: [['紧凑版', '7 张'], ['向外生长版', '10 张']] },
  { id: 'editorial', name: '杂志散点', note: '照片与标题形成阅读节奏', templates: [['中心标题式', '8 张'], ['封面式', '10 张']] },
  { id: 'prints', name: '相纸叠放', note: '带着白边的日常照片', templates: [['整齐相纸墙', '9 张'], ['随手叠放', '6 张']] },
  { id: 'torn', name: '撕纸剪贴', note: '固定 6 图的纸张叙事', templates: [['纸上瞬间', '6 张']] },
]

const TONES = ['sunset', 'lake', 'street', 'cloud', 'forest', 'night']

function BackBar({ onBack, rightLabel, onRight }) {
  return (
    <header className="flow-bar">
      {onBack ? <button type="button" onClick={onBack}>← 返回</button> : <span>ALBUMMM</span>}
      {rightLabel ? <button type="button" onClick={onRight}>{rightLabel}</button> : <span className="flow-bar__quiet">照片拼贴</span>}
    </header>
  )
}

function MiniPreview({ type }) {
  return (
    <span className={`mini-preview mini-preview--${type}`} aria-hidden="true">
      <i /><i /><i /><i /><i /><i />
      {type === 'editorial' && <b>moments</b>}
    </span>
  )
}

function Photos({ framed = true, className = '' }) {
  return TONES.map((tone, index) => (
    <span key={tone} className={`${framed ? 'flow-photo' : 'flow-block'} ${className} ${className ? `${className}--${index + 1}` : ''}`}>
      <i className={`flow-photo__image flow-photo__image--${tone}`} />
      {framed && <small>{index === 0 ? '01' : ''}</small>}
    </span>
  ))
}

function Artwork({ category, stacked = false }) {
  return (
    <section className={`flow-art flow-art--${category} ${stacked ? 'flow-art--stacked' : ''}`}>
      {category === 'prints' || category === 'torn' ? <Photos className="art-card" /> : <Photos framed={false} className="art-card" />}
      {category === 'editorial' && <strong>little<br />moments</strong>}
      {category === 'torn' && <><span className="art-tape art-tape--one" /><span className="art-tape art-tape--two" /></>}
    </section>
  )
}

export default function CollageFlowPrototype() {
  const [screen, setScreen] = useState('home')
  const [categoryId, setCategoryId] = useState('prints')
  const [templateIndex, setTemplateIndex] = useState(1)
  const [photosReady, setPhotosReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [works, setWorks] = useState([])
  const [downloaded, setDownloaded] = useState(false)

  const category = CATEGORIES.find((item) => item.id === categoryId)
  const template = category.templates[templateIndex] || category.templates[0]
  const requiredCount = Number(template[1].match(/\d+/)?.[0] || 6)

  const chooseCategory = (id) => {
    setCategoryId(id)
    setTemplateIndex(id === 'prints' ? 1 : 0)
    setScreen('templates')
  }

  const beginReveal = () => {
    setExpanded(false)
    setScreen('reveal')
  }

  const finish = () => {
    setWorks((previous) => previous.length ? previous : [{ id: Date.now(), category: categoryId, template: template[0] }])
    setScreen('result')
  }

  return (
    <main className="flow-prototype">
      <section className="flow-phone">
        {screen === 'home' && (
          <>
            <BackBar rightLabel="我的" onRight={() => setScreen('library')} />
            <section className="flow-home-intro">
              <p>MAKE A PAGE</p>
              <h1>把照片<br />摊成一页。</h1>
              <span>选一种方式，上传照片，向上展开。</span>
            </section>
            <section className="flow-category-list">
              {CATEGORIES.map((item) => (
                <button key={item.id} type="button" className="flow-category" onClick={() => chooseCategory(item.id)}>
                  <MiniPreview type={item.id} />
                  <span><b>{item.name}</b><small>{item.note}</small></span><em>→</em>
                </button>
              ))}
            </section>
          </>
        )}

        {screen === 'templates' && (
          <>
            <BackBar onBack={() => setScreen('home')} rightLabel="我的" onRight={() => setScreen('library')} />
            <section className="flow-page-title"><p>{category.name.toUpperCase()}</p><h1>选择一种版式</h1><span>{category.note}</span></section>
            <section className="flow-template-list">
              {category.templates.map((item, index) => (
                <button key={item[0]} type="button" className={`flow-template ${templateIndex === index ? 'flow-template--selected' : ''}`} onClick={() => setTemplateIndex(index)}>
                  <Artwork category={categoryId} />
                  <span><b>{item[0]}</b><small>{item[1]} · 自动排版</small></span>
                  <i>{templateIndex === index ? '已选' : '选择'}</i>
                </button>
              ))}
            </section>
            <button type="button" className="flow-primary" onClick={() => setScreen('upload')}>继续</button>
          </>
        )}

        {screen === 'upload' && (
          <>
            <BackBar onBack={() => setScreen('templates')} rightLabel="我的" onRight={() => setScreen('library')} />
            <section className="flow-page-title"><p>{category.name} · {template[0]}</p><h1>添加 {requiredCount} 张照片</h1><span>第一张会成为主图。想突出哪张，就先添加它。</span></section>
            <section className="flow-upload-grid">
              {Array.from({ length: requiredCount }, (_, index) => (
                <span key={index} className={`flow-upload-slot ${photosReady ? 'flow-upload-slot--ready' : ''}`}>
                  {photosReady ? <i className={`flow-photo__image flow-photo__image--${TONES[index % TONES.length]}`} /> : <b>+</b>}
                  <small>{index === 0 ? '主图 / 01' : String(index + 1).padStart(2, '0')}</small>
                </span>
              ))}
            </section>
            {!photosReady ? (
              <button type="button" className="flow-primary" onClick={() => setPhotosReady(true)}>添加 {requiredCount} 张示例照片</button>
            ) : (
              <button type="button" className="flow-primary" onClick={beginReveal}>开始排版</button>
            )}
            <p className="flow-prototype-note">原型使用示例照片；正式版在这里打开系统相册。</p>
          </>
        )}

        {screen === 'reveal' && (
          <>
            <BackBar onBack={() => setScreen('upload')} />
            <section className="flow-reveal-copy"><p>准备好了</p><h1>{expanded ? '照片已归位' : '向上展开照片'}</h1></section>
            <Artwork category={categoryId} stacked={!expanded} />
            {!expanded ? (
              <button type="button" className="flow-gesture" onClick={() => setExpanded(true)}><b>↑</b>向上拖动照片堆</button>
            ) : (
              <button type="button" className="flow-primary flow-primary--reveal" onClick={finish}>查看成品</button>
            )}
          </>
        )}

        {screen === 'result' && (
          <>
            <BackBar onBack={() => setScreen('home')} rightLabel="我的" onRight={() => setScreen('library')} />
            <section className="flow-result-copy"><span>已自动存入我的</span><h1>{template[0]}</h1></section>
            <Artwork category={categoryId} />
            <section className="flow-result-actions">
              <button type="button" className="flow-primary" onClick={() => setDownloaded(true)}>{downloaded ? '已下载图片' : '下载图片'}</button>
              <button type="button" onClick={() => setScreen('library')}>查看我的</button>
            </section>
          </>
        )}

        {screen === 'library' && (
          <>
            <BackBar onBack={() => setScreen('home')} />
            <section className="flow-page-title flow-page-title--library"><p>MY PAGES</p><h1>我的</h1><span>{works.length ? '作品仅保存于这台设备' : '你还没有作品'}</span></section>
            {works.length ? (
              <section className="flow-library-grid">
                {works.map((work) => <button type="button" key={work.id} onClick={() => { setCategoryId(work.category); setScreen('result') }}><Artwork category={work.category} /><span>{work.template}<small>刚刚创建</small></span></button>)}
              </section>
            ) : <section className="flow-empty"><b>+ </b><span>第一张拼贴页<br />会出现在这里</span></section>}
          </>
        )}
      </section>
      <aside className="flow-state"><span>原型状态</span><p>{screen === 'home' ? '首页只给四个大类。' : screen === 'templates' ? '类型内部再选择具体母板。' : screen === 'upload' ? '第一张照片默认是主图。' : screen === 'reveal' ? '照片从有质感的堆叠展开。' : screen === 'result' ? '作品自动保存，下载是唯一主操作。' : '“我的”按设备本地保存作品。'}</p></aside>
    </main>
  )
}
