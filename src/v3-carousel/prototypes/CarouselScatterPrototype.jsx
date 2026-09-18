import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toBlob } from 'html-to-image'
import { makeDemoPhotos } from '../../shared/demo.js'
import { loadPhoto } from '../../shared/photo.js'
import { EXPORT_WIDTH, clamp, matFor, placeFrame, planSmartStory, rngFrom, STYLE_LAYOUTS } from '../layout/carouselPlacement.js'
import './CarouselMastersPrototype.css'
import './CarouselScatterPrototype.css'

// PROTOTYPE — Can a seeded, geometry-only loose layout preserve photo ratios
// while allowing small paper-card overlaps? Open /?prototype=carousel-scatter.

// 导出规格：两个格式共用同一份「4:5 作品」，9:16 只是把它居中放在更高的画布上，
// 多出来的上下两条是延伸的纸面背景 —— 这样两种格式是同一件作品，不会出现构图不一致。
const EXPORT_FORMATS = [
  {
    id: 'feed', slug: '4x5', label: '4:5', width: 1080, height: 1350, artHeight: 1350,
    paper: { gallery: '#e7e4dc', muse: '#d9cabd', weekend: '#d1cec5' },
  },
  {
    id: 'story', slug: '9x16', label: '9:16', width: 1080, height: 1920, artHeight: 1350,
    paper: { gallery: '#e7e4dc', muse: '#d9cabd', weekend: '#d1cec5' },
  },
]

// 用户选择风格；随机的位置、尺寸与轻叠只是各风格内部的排版规则。
// 几何参数放在 layout/carouselPlacement.js，与分页规则一样可以用固定种子回归。
const STYLES = [
  { id: 'gallery', label: '01', name: 'Gallery', ...STYLE_LAYOUTS.gallery, note: '安静纸面 · 规整留白 · 照片完整呈现。' },
  { id: 'muse', label: '02', name: 'Muse', ...STYLE_LAYOUTS.muse, note: '柔和色带 · 轻微错位 · 更有 editorial 感。' },
  { id: 'weekend', label: '03', name: 'Weekend', ...STYLE_LAYOUTS.weekend, note: '网格片段 · 节奏更快 · 可以有少量轻叠。' },
]
const LEGACY_STYLE_BY_STRATEGY = { edge: 'gallery', soft: 'muse', cluster: 'weekend' }

// PROTOTYPE — Three five-page rhythm recipes on /?prototype=carousel-rhythm.
// They set page-level emphasis only; the final position of every photo stays seeded-random.
const RHYTHMS = {
  gallery: [
    { id: 'pair', label: '双图关系', anchorShort: .37, fragmentBase: .22, fragmentRange: .06 },
    { id: 'cluster', label: '片段组合', anchorShort: .32, fragmentBase: .2, fragmentRange: .07 },
    { id: 'pair', label: '双图关系', anchorShort: .37, fragmentBase: .22, fragmentRange: .06 },
    { id: 'cluster', label: '片段组合', anchorShort: .32, fragmentBase: .2, fragmentRange: .07 },
    { id: 'pair', label: '双图收束', anchorShort: .36, fragmentBase: .22, fragmentRange: .06 },
  ],
  muse: [
    { id: 'pair', label: '不对称双图', anchorShort: .38, fragmentBase: .23, fragmentRange: .07 },
    { id: 'cluster', label: '片段组合', anchorShort: .33, fragmentBase: .2, fragmentRange: .08 },
    { id: 'pair', label: '双图关系', anchorShort: .38, fragmentBase: .23, fragmentRange: .07 },
    { id: 'cluster', label: '片段组合', anchorShort: .33, fragmentBase: .2, fragmentRange: .08 },
    { id: 'pair', label: '双图收束', anchorShort: .37, fragmentBase: .22, fragmentRange: .07 },
  ],
  weekend: [
    { id: 'cluster', label: '片段开场', anchorShort: .33, fragmentBase: .2, fragmentRange: .09 },
    { id: 'pair', label: '两图关系', anchorShort: .38, fragmentBase: .23, fragmentRange: .08 },
    { id: 'cluster', label: '片段高点', anchorShort: .33, fragmentBase: .2, fragmentRange: .1 },
    { id: 'pair', label: '双图停顿', anchorShort: .37, fragmentBase: .22, fragmentRange: .08 },
    { id: 'cluster', label: '片段收束', anchorShort: .32, fragmentBase: .2, fragmentRange: .08 },
  ],
}

function capacityFor(recipe) {
  return recipe ? 2 : 1
}

function overflowRecipeFor(recipes) {
  return recipes?.find((recipe) => recipe.id === 'cluster') ?? {
    id: 'cluster', label: '片段补充', anchorShort: .38, fragmentBase: .24, fragmentRange: .1,
  }
}

function groupsFor(photos, recipes = null) {
  if (recipes) {
    const remaining = [...photos]
    const frames = recipes.map((recipe) => ({
      photos: remaining.splice(0, capacityFor(recipe)),
      recipe,
    })).filter((frame) => frame.photos.length)
    const overflowRecipe = overflowRecipeFor(recipes)
    while (remaining.length) {
      frames.push({ photos: remaining.splice(0, capacityFor(overflowRecipe)), recipe: overflowRecipe })
    }
    return frames
  }
  const frames = Array.from({ length: 5 }, () => ({ photos: [], recipe: null }))
  photos.forEach((photo, index) => {
    const frame = Math.min(4, Math.floor(index * 5 / photos.length))
    frames[frame].photos.push(photo)
  })
  return frames
}

// smart 的整组规划已移到 layout/carouselPlacement.js；这里只保留 scatter / rhythm 两条历史路径。
function planStory(photos, seed, style, rhythm = false, smart = false) {
  if (smart) return planSmartStory(photos, seed, style)
  const random = rngFrom(seed)
  const frames = []
  let pending = []
  const recipes = rhythm ? RHYTHMS[style.id] : null
  const groups = groupsFor(photos, recipes)
  groups.forEach(({ photos: group, recipe }) => {
    const frame = placeFrame(rhythm ? group : [...pending, ...group], random, style, recipe)
    frames.push({ ...frame, recipe })
    if (rhythm) {
      let overflow = frame.unplaced
      const overflowRecipe = overflowRecipeFor(recipes)
      while (overflow.length) {
        const overflowFrame = placeFrame(overflow, random, style, overflowRecipe)
        frames.push({ ...overflowFrame, recipe: overflowRecipe })
        if (!overflowFrame.placed.length) {
          frames.push({ ...placeFrame([overflow[0]], random, style, overflowRecipe), recipe: overflowRecipe })
          overflow = overflow.slice(1)
        } else {
          overflow = overflowFrame.unplaced
        }
      }
    } else {
      pending = frame.unplaced
    }
  })
  while (pending.length) {
    const recipe = frames.at(-1)?.recipe ?? recipes?.[recipes.length - 1] ?? null
    const frame = placeFrame(pending, random, style, recipe)
    if (!frame.placed.length) {
      // 极端比例也必须保留完整展示：单独占一页，而不是突破最小尺度。
      frames.push({ ...placeFrame([pending[0]], random, style, recipe), recipe })
      pending = pending.slice(1)
    } else {
      frames.push({ ...frame, recipe })
      pending = frame.unplaced
    }
  }
  return {
    frames,
    pagePlan: groups.map((group) => group.photos.length),
    rejected: frames.reduce((sum, frame) => sum + frame.rejected, 0),
    overlaps: frames.reduce((sum, frame) => sum + frame.overlaps, 0),
    contentCollisions: frames.reduce((sum, frame) => sum + frame.contentCollisions, 0),
  }
}

// 白边按页宽换算成百分比：预览里每页只有 216–335px 宽，若照搬 1080 尺度的裸 px，
// 预览的白边会比真实导出粗 4–5 倍。百分比 padding 以父级（页面）宽度为基准，
// 换算出来的水平/垂直内缩正好等于 innerBox() 在 1080×1350 导出尺度下的值，预览即导出。
function matPercentFor(box) {
  return matFor(box) / EXPORT_WIDTH * 100
}

function ScatterFrame({ frame, index, rhythm }) {
  return (
    <article className={`carousel-master__frame scatter-frame ${rhythm && frame.recipe ? `rhythm-frame rhythm-frame--${frame.recipe.id}` : ''}`}>
      <span className="carousel-master__number">{String(index + 1).padStart(2, '0')}</span>
      {rhythm && frame.recipe && <span className="rhythm-frame__role">{frame.recipe.label}</span>}
      {frame.placed.map(({ photo, x, y, w, h, rotate }) => (
        <figure
          key={photo.id}
          className="carousel-master__photo scatter-card"
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, rotate: `${rotate}deg`, '--scatter-mat': `${matPercentFor({ w, h })}%` }}
        >
          <img src={photo.previewSrc} alt="随机排版中的照片" />
        </figure>
      ))}
    </article>
  )
}

function StyleSwitcher({ activeId, onChange }) {
  const index = STYLES.findIndex((style) => style.id === activeId)
  const previous = STYLES[(index - 1 + STYLES.length) % STYLES.length]
  const next = STYLES[(index + 1) % STYLES.length]
  const active = STYLES[index]
  return (
    <nav className="carousel-master__switcher" aria-label="切换视觉风格">
      <button type="button" onClick={() => onChange(previous.id)} aria-label="上一个风格">←</button>
      <span>{active.label} · {active.name}</span>
      <button type="button" onClick={() => onChange(next.id)} aria-label="下一个风格">→</button>
    </nav>
  )
}

export default function CarouselScatterPrototype({ rhythm = false, smart = false }) {
  const params = new URLSearchParams(window.location.search)
  const requestedStyle = LEGACY_STYLE_BY_STRATEGY[params.get('variant')] ?? params.get('variant')
  const initial = STYLES.some((style) => style.id === requestedStyle) ? requestedStyle : 'gallery'
  const [activeId, setActiveId] = useState(initial)
  const [photos, setPhotos] = useState([])
  const [seed, setSeed] = useState(4128)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef(null)
  const style = STYLES.find((item) => item.id === activeId)

  useEffect(() => {
    let live = true
    const requestedDemoCount = Number.parseInt(new URLSearchParams(window.location.search).get('demo'), 10)
    const demoCount = Number.isFinite(requestedDemoCount) ? clamp(requestedDemoCount, 1, 24) : 10
    makeDemoPhotos(demoCount).then((demo) => {
      if (!live) return
      setPhotos(demo)
      setLoading(false)
    })
    return () => { live = false }
  }, [])

  const changeStyle = (id) => {
    const next = new URLSearchParams(window.location.search)
    next.set('prototype', smart ? 'carousel-smart' : rhythm ? 'carousel-rhythm' : 'carousel-scatter')
    next.set('variant', id)
    window.history.replaceState(null, '', `?${next.toString()}`)
    setActiveId(id)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target.matches('input, textarea, [contenteditable="true"]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = STYLES.findIndex((item) => item.id === activeId)
      changeStyle(STYLES[event.key === 'ArrowLeft' ? (index + 2) % 3 : (index + 1) % 3].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeId])

  const addPhotos = async (event) => {
    const files = [...event.target.files].filter((file) => file.type.startsWith('image/')).slice(0, 24)
    if (!files.length) return
    setLoading(true)
    setPhotos(await Promise.all(files.map(loadPhoto)))
    setSeed(Math.floor(Math.random() * 1e9))
    setLoading(false)
    event.target.value = ''
  }

  // 逐页导出：把该页渲染到 1080 宽的离屏画布上（正好是几何计算所用的尺度），
  // 再交给 html-to-image 输出 1:1 的 PNG。先在离屏画布上渲染一页、等图片就绪，再截图，
  // 逐页推进；这样手机上也只需要一页的内存。
  const exportRef = useRef(null)
  const [exportJob, setExportJob] = useState(null)

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const exportPages = async (format) => {
    if (!story || exportJob) return
    const total = story.frames.length
    for (let index = 0; index < total; index += 1) {
      // flushSync：保证这一页已经挂到 DOM 上再截图，不靠等帧去猜 React 何时提交。
      flushSync(() => setExportJob({ formatId: format.id, index, total }))
      const node = exportRef.current
      if (!node) break
      await Promise.all([...node.querySelectorAll('img')].map((img) => (
        img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve })
      )))
      const blob = await toBlob(node, { pixelRatio: 1, cacheBust: false, backgroundColor: format.paper[activeId] })
      if (blob) downloadBlob(blob, `albummm-v3-${format.slug}-${String(index + 1).padStart(2, '0')}.png`)
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    flushSync(() => setExportJob(null))
  }

  const story = photos.length ? planStory(photos, seed, style, rhythm, smart) : null
  const exportFormat = exportJob ? EXPORT_FORMATS.find((item) => item.id === exportJob.formatId) : null
  return (
    <main className={`carousel-master scatter-prototype ${rhythm ? 'rhythm-prototype' : ''} ${smart ? 'smart-prototype' : ''} scatter-prototype--${activeId}`}>
      <header className="carousel-master__header">
        <div>
          <p>PROTOTYPE · V3 {smart ? '智能分页随机' : rhythm ? '五页基准节奏' : '受控随机片段'}</p>
          <h1>{style.name}</h1>
          <span>{style.note}</span>
        </div>
        <div className="carousel-master__actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
          <button type="button" onClick={() => inputRef.current?.click()}>换一组照片</button>
          <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>换一组排法</button>
          {smart && EXPORT_FORMATS.map((format) => (
            <button key={format.id} type="button" disabled={Boolean(exportJob) || !story} onClick={() => exportPages(format)}>
              导出 {format.label}
            </button>
          ))}
        </div>
      </header>

      <section className="scatter-prototype__state" aria-label="排版状态">
        <span>seed {seed}</span>
        <span>内容短边 ≥ 20%</span>
        <span>横 ≤ 80% · 竖 ≤ 78%</span>
        <span>外层卡片覆盖 ≤ {Math.round(style.overlap * 100)}%</span>
        <span>照片内容区碰撞 {story?.contentCollisions ?? 0}</span>
        <span>{story ? `已拒绝 ${story.rejected} 个候选位置 · 接受 ${story.overlaps} 处轻叠` : '正在计算'}</span>
        {smart && story && <span>智能分页：{story.pagePlan.join(' · ')} 张 / 页</span>}
        {smart && story && <span>{story.frames.length} 页输出</span>}
        {smart && story && story.frames.some((frame) => (frame.fittingScale ?? 1) < 1) && (
          <span>
            自动缩放 {story.frames.filter((frame) => (frame.fittingScale ?? 1) < 1).length} 页 · 最小 {Math.round(Math.min(...story.frames.map((frame) => frame.fittingScale ?? 1)) * 100)}%
          </span>
        )}
        {rhythm && story && <span>{story.frames.length} 页输出</span>}
        {rhythm && story && <span>节奏：{story.frames.slice(0, 5).map((frame) => frame.recipe?.label).filter(Boolean).join(' → ')}</span>}
        {exportJob && <span>正在导出 {exportJob.index + 1} / {exportJob.total} 页（{EXPORT_FORMATS.find((item) => item.id === exportJob.formatId)?.label}）</span>}
      </section>

      <section className="carousel-master__stage" aria-label={smart ? '智能分页随机连续作品预览' : rhythm ? '五页节奏连续作品预览' : '五页随机连续作品预览'}>
        {loading || !story ? <p className="carousel-master__loading">正在计算卡片位置…</p> : (
          <div className="carousel-master__strip scatter-strip" style={{ '--scatter-page-count': story.frames.length }}>
            {story.frames.map((frame, index) => <ScatterFrame key={index} frame={frame} index={index} rhythm={rhythm} />)}
          </div>
        )}
      </section>

      <aside className="carousel-master__rules">
        <span>本轮验证</span>
        <p>{smart
          ? '系统先计算每页 2–4 张照片：十张以上优先给出五页，2 张页占主导、3 张页补足数量、4 张页最多一次。之后才在每页内生成多轮随机位置方案，留下完整放下且最自然的一轮。三种风格只改变纸面气质，不改变分页规则。'
          : rhythm
          ? '这一版只规定每页承担的观看角色；照片的具体位置、尺寸与轻叠仍由种子随机决定。请判断它是否让整组更有起伏，而没有牺牲当前的自由感。'
          : '随机位置只能在已确定的内容尺寸范围内移动；放不下的照片自动顺延到下一页。白边是更细的装裱边，也是保护照片内容的碰撞缓冲区。'}
        </p>
      </aside>

      {/* 离屏导出画布：按 1080 宽渲染单页（正是几何计算所用的尺度）。
          背景挂在整条带子上，所以这里按页号把同一张背景平移到本页位置，
          切出来的每一页与「连续带子」上的那一格完全一致。 */}
      {exportJob && exportFormat && story && (
        <div className="scatter-export-holder">
          <div
            ref={exportRef}
            className={`scatter-export scatter-export--${activeId}`}
            data-scatter-page={exportJob.index + 1}
            style={{
              width: `${exportFormat.width}px`,
              height: `${exportFormat.height}px`,
              '--scatter-page-count': story.frames.length,
              '--scatter-page-index': exportJob.index,
              '--scatter-art-height': `${exportFormat.artHeight}px`,
            }}
          >
            <div className="scatter-export__paper" />
            <div className="scatter-export__art">
              <ScatterFrame frame={story.frames[exportJob.index]} index={exportJob.index} rhythm={false} />
            </div>
          </div>
        </div>
      )}

      <StyleSwitcher activeId={activeId} onChange={changeStyle} />
    </main>
  )
}
