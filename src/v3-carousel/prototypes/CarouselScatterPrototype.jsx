import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toBlob } from 'html-to-image'
import { makeDemoPhotos } from '../../shared/demo.js'
import { loadPhoto } from '../../shared/photo.js'
import { BORDER_STYLES, DEFAULT_BORDER, DEFAULT_EDGE, DEFAULT_FORMAT, DEFAULT_TAPE, EDGE_STYLES, PAGE_FORMATS, TAPE_STYLES, clamp, matInsets, materialOf, placeFrame, planSmartStory, rngFrom, STYLE_LAYOUTS } from '../layout/carouselPlacement.js'
import './CarouselMastersPrototype.css'
import './CarouselScatterPrototype.css'

// PROTOTYPE — Can a seeded, geometry-only loose layout preserve photo ratios
// while allowing small paper-card overlaps? Open /?prototype=carousel-scatter.

// 页面规格来自几何层（PAGE_FORMATS）：每个规格都按自己的页面比例重新构图，
// 不是把一种构图缩放进另一种画布。这里的 paper 只作为 html-to-image 的兜底色，
// 真正的纸面背景由 CSS 变量（--paper-*）提供。
const PAPER_COLORS = { gallery: '#e7e4dc', muse: '#d9cabd', weekend: '#d1cec5' }
const FORMATS = Object.values(PAGE_FORMATS)
const formatById = (id) => PAGE_FORMATS[id] ?? DEFAULT_FORMAT

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
function planStory(photos, seed, style, rhythm = false, smart = false, format = DEFAULT_FORMAT, material = undefined) {
  if (smart) return planSmartStory(photos, seed, style, format, material)
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
// 换算出来的水平/垂直内缩正好等于 innerBox() 在导出尺度下的值，预览即导出。
function matPercents(box, format, material) {
  // 用几何层存在卡片上的边框值（box.mat），渲染与碰撞判定才是同一套数字。
  const mat = box.mat ?? matInsets(box, format, material)
  return {
    x: mat.x / format.width * 100,
    top: mat.top / format.width * 100,
    bottom: mat.bottom / format.width * 100,
    px: mat,
  }
}

// 毛边：在「相纸层」上裁出不规则轮廓。要点（对着参考图调的）：
//   · 每条边 22 个采样点 —— 点太少就只是平缓波浪，不像撕纸；
//   · 三层频率叠加（慢起伏 + 快抖动 + 偶发深缺口），轮廓才不规则；
//   · 每张卡片有一条「主撕边」（更深），其余三条浅一点，像从纸卷上撕下来的；
//   · 深度硬性封顶在白边宽度内（≤ 出血带），所以永远不会啃到照片内容。
// 返回外轮廓与内轮廓：内轮廓用来画那圈纤维毛边。
function tornContours(card, format, material, photoId) {
  const tear = material.edge?.tear ?? 0
  if (!tear) return null
  const mat = card.mat ?? matInsets(card, format, material)
  const maxX = mat.x * tear / (card.w * format.width) * 100
  const maxY = (mat.top * tear) / (card.h * format.height) * 100
  const seed = [...photoId].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7)
  const primary = seed % 4

  const hash = (index, salt) => {
    const value = Math.sin(seed * 12.9898 + salt * 78.233 + index * 37.719) * 43758.5453
    return value - Math.floor(value)
  }
  const depth = (index, salt, max, side) => {
    const slow = .5 + .5 * Math.sin(index * .5 + seed * .07 + salt)
    const fast = hash(index, salt)
    const notch = hash(index * 5 + salt, salt * 3) > .8 ? 1.45 : 1
    const boost = side === primary ? 1.35 : 1
    return Math.min(max, max * (.24 + slow * .34 + fast * .42) * notch * boost)
  }

  const polygon = (scale) => {
    const steps = 22
    const ax = maxX * scale
    const ay = maxY * scale
    const points = []
    for (let index = 0; index <= steps; index += 1) points.push(`${(index / steps * 100).toFixed(2)}% ${depth(index, 1, ay, 0).toFixed(2)}%`)
    for (let index = 1; index <= steps; index += 1) points.push(`${(100 - depth(index, 7, ax, 1)).toFixed(2)}% ${(index / steps * 100).toFixed(2)}%`)
    for (let index = steps - 1; index >= 0; index -= 1) points.push(`${(index / steps * 100).toFixed(2)}% ${(100 - depth(index, 13, ay, 2)).toFixed(2)}%`)
    for (let index = steps - 1; index >= 1; index -= 1) points.push(`${depth(index, 19, ax, 3).toFixed(2)}% ${(index / steps * 100).toFixed(2)}%`)
    return `polygon(${points.join(', ')})`
  }

  return { outer: polygon(1), inner: polygon(.66) }
}

function ScatterFrame({ frame, index, rhythm, showNumber = true, format = DEFAULT_FORMAT, material = undefined }) {
  const spec = materialOf(material)
  // 胶带的位置：从卡片上缘越出，一半在卡片上、一半贴纸底；由几何层决定哪几张带胶带。
  const tapeHeight = (spec.tape.thickness * format.width) / format.height * 100
  return (
    <article className={`carousel-master__frame scatter-frame ${rhythm && frame.recipe ? `rhythm-frame rhythm-frame--${frame.recipe.id}` : ''}`}>
      {showNumber && <span className="carousel-master__number">{String(index + 1).padStart(2, '0')}</span>}
      {rhythm && frame.recipe && <span className="rhythm-frame__role">{frame.recipe.label}</span>}
      {frame.placed.map(({ photo, x, y, w, h, rotate, mat: cardMat, tape }, cardIndex) => {
        const mat = matPercents({ w, h, mat: cardMat }, format, spec)
        const torn = tornContours({ w, h, mat: cardMat }, format, spec, photo.id)
        return (
          <figure
            key={photo.id}
            className={`carousel-master__photo scatter-card${spec.edge.id === 'torn' ? ' scatter-card--torn' : ''}`}
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${w * 100}%`,
              rotate: `${rotate}deg`,
              '--scatter-mat': `${mat.x}%`,
              '--scatter-mat-top': `${mat.top}%`,
              '--scatter-mat-bottom': `${mat.bottom}%`,
              '--scatter-tape-w': `${(spec.tape.lengthScale ?? 0) * 100}%`,
              '--scatter-tape-h': `${tapeHeight}%`,
            }}
          >
            {/* 相纸层单独裁毛边（不是裁整个卡片），这样胶带才能越出卡片而不被裁断。 */}
            <span className="scatter-card__paper" style={{ clipPath: torn?.outer }} aria-hidden="true" />
            {/* 纤维毛边：比外轮廓内缩一圈，露出一条毛糙的纸纤维边（参考图里最像撕纸的那部分）。 */}
            {torn && <span className="scatter-card__fringe" style={{ clipPath: torn.inner }} aria-hidden="true" />}
            <img src={photo.previewSrc} alt="随机排版中的照片" />
            {spec.tape.enabled && tape && (
              <span
                className="scatter-tape"
                style={{
                  // 与几何层 tapeRect 同一套算法：下端停在照片内容上边界，上端越出卡片。
                  top: `${-Math.max(0, spec.tape.thickness - mat.px.top / format.width) / h * 100}%`,
                  rotate: `${cardIndex % 2 ? 4.5 : -3.5}deg`,
                }}
                aria-hidden="true"
              />
            )}
          </figure>
        )
      })}
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
  const [previewFormatId, setPreviewFormatId] = useState(DEFAULT_FORMAT.id)
  const [borderId, setBorderId] = useState(DEFAULT_BORDER.id)
  const [edgeId, setEdgeId] = useState(DEFAULT_EDGE.id)
  const [tapeId, setTapeId] = useState(DEFAULT_TAPE.id)
  const [showNumbers, setShowNumbers] = useState(true)
  const inputRef = useRef(null)
  const style = STYLES.find((item) => item.id === activeId)
  const previewFormat = formatById(previewFormatId)
  const material = materialOf({ border: BORDER_STYLES[borderId], edge: EDGE_STYLES[edgeId], tape: TAPE_STYLES[tapeId] })

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
    // 导出的是目标规格自己的构图：按该规格重新规划一遍，而不是复用预览里的 4:5 排版。
    const target = photos.length ? planStory(photos, seed, style, rhythm, smart, format, material) : null
    if (!target) return
    const total = target.frames.length
    for (let index = 0; index < total; index += 1) {
      // flushSync：保证这一页已经挂到 DOM 上再截图，不靠等帧去猜 React 何时提交。
      flushSync(() => setExportJob({ formatId: format.id, index, total }))
      const node = exportRef.current
      if (!node) break
      await Promise.all([...node.querySelectorAll('img')].map((img) => (
        img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve })
      )))
      const blob = await toBlob(node, { pixelRatio: 1, cacheBust: false, backgroundColor: PAPER_COLORS[activeId] })
      if (blob) downloadBlob(blob, `albummm-v3-${format.id}-${String(index + 1).padStart(2, '0')}.png`)
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    flushSync(() => setExportJob(null))
  }

  const story = photos.length ? planStory(photos, seed, style, rhythm, smart, previewFormat, material) : null
  const exportFormat = exportJob ? formatById(exportJob.formatId) : null
  const exportStory = exportJob && photos.length ? planStory(photos, seed, style, rhythm, smart, exportFormat, material) : null
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
          {smart && FORMATS.map((format) => (
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
        {exportJob && <span>正在导出 {exportJob.index + 1} / {exportJob.total} 页（{exportFormat?.label}）</span>}
        {smart && (
          <span className="scatter-prototype__control">
            预览
            {FORMATS.map((format) => (
              <button
                key={format.id}
                type="button"
                className={format.id === previewFormat.id ? 'is-active' : ''}
                onClick={() => setPreviewFormatId(format.id)}
              >
                {format.label}
              </button>
            ))}
          </span>
        )}
        {smart && (
          <span className="scatter-prototype__control">
            边框
            {Object.values(BORDER_STYLES).map((item) => (
              <button key={item.id} type="button" className={item.id === borderId ? 'is-active' : ''} onClick={() => setBorderId(item.id)}>
                {item.label}
              </button>
            ))}
          </span>
        )}
        {smart && (
          <span className="scatter-prototype__control">
            边缘
            {Object.values(EDGE_STYLES).map((item) => (
              <button key={item.id} type="button" className={item.id === edgeId ? 'is-active' : ''} onClick={() => setEdgeId(item.id)}>
                {item.label}
              </button>
            ))}
          </span>
        )}
        {smart && (
          <span className="scatter-prototype__control">
            胶带
            {Object.values(TAPE_STYLES).map((item) => (
              <button key={item.id} type="button" className={item.id === tapeId ? 'is-active' : ''} onClick={() => setTapeId(item.id)}>
                {item.label}
              </button>
            ))}
          </span>
        )}
        {smart && (
          <span className="scatter-prototype__control">
            <button type="button" className={showNumbers ? 'is-active' : ''} onClick={() => setShowNumbers(!showNumbers)}>
              页码
            </button>
          </span>
        )}
      </section>

      <section className="carousel-master__stage" aria-label={smart ? '智能分页随机连续作品预览' : rhythm ? '五页节奏连续作品预览' : '五页随机连续作品预览'}>
        {loading || !story ? <p className="carousel-master__loading">正在计算卡片位置…</p> : (
          <div
            className="carousel-master__strip scatter-strip"
            style={{ '--scatter-page-count': story.frames.length, '--scatter-page-aspect': previewFormat.aspect }}
          >
            {story.frames.map((frame, index) => (
              <ScatterFrame key={index} frame={frame} index={index} rhythm={rhythm} showNumber={showNumbers} format={previewFormat} material={material} />
            ))}
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
      {exportJob && exportFormat && exportStory && (
        <div className="scatter-export-holder">
          <div
            ref={exportRef}
            className={`scatter-export scatter-export--${activeId}`}
            data-scatter-page={exportJob.index + 1}
            style={{
              width: `${exportFormat.width}px`,
              height: `${exportFormat.height}px`,
              '--scatter-page-count': exportStory.frames.length,
              '--scatter-page-index': exportJob.index,
            }}
          >
            <div className="scatter-export__paper" />
            <div className="scatter-export__art">
              <ScatterFrame frame={exportStory.frames[exportJob.index]} index={exportJob.index} rhythm={false} showNumber={showNumbers} format={exportFormat} material={material} />
            </div>
          </div>
        </div>
      )}

      <StyleSwitcher activeId={activeId} onChange={changeStyle} />
    </main>
  )
}
