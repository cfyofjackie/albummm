import { useEffect, useState } from 'react'
import './CollageMastersPrototype.css'

// PROTOTYPE — What should the four collage master layouts feel like?
// Run `npm run dev`, then open `/?prototype=collage-masters`.

const VARIANTS = [
  {
    id: 'neat-grid',
    label: '01',
    name: '整齐拼图 · 紧凑版',
    count: '7 张照片 · 规则 / 边缘清晰',
    rules: '一张主图，六张辅助图；全部直角、不旋转、不叠压，照片聚成一个紧密整体。',
  },
  {
    id: 'neat-grow',
    label: '02',
    name: '整齐拼图 · 向外生长版',
    count: '10 张照片 · 规则 / 边缘清晰',
    rules: '从中心照片群向四周延伸；所有照片贴合成一个不规则整体，仍不旋转、不叠压。',
  },
  {
    id: 'editorial-scatter',
    label: '03',
    name: '杂志散点',
    count: '8 张照片 · 规则 / 杂志编排',
    rules: '照片仍是直角且互不遮挡；以模板内置的大标题作为画面重心，照片围绕标题散点分布。',
  },
  {
    id: 'editorial-cover',
    label: '04',
    name: '杂志散点 · 封面式',
    count: '10 张照片 · 规则 / 杂志封面',
    rules: '左上固定三行大标题，照片以较均匀的密度散布整张暖色纸面；不重叠，使用模板内置的副标题与署名。',
  },
  {
    id: 'print-wall',
    label: '05',
    name: '相纸叠放 · 整齐相纸墙',
    count: '9 张照片 · 规整 / 相纸边框',
    rules: '九张统一白边相纸等距排列；没有旋转、遮挡或装饰。风格只来自相纸材质与整齐的收藏感。',
  },
  {
    id: 'print-stack',
    label: '06',
    name: '相纸叠放 · 随手叠放',
    count: '6 张照片 · 自由 / 相纸边框',
    rules: '所有照片都有白色相纸边；只允许轻微旋转和有限遮挡。固定两条半透明纸胶带，不加入随机涂鸦、贴纸或文字。',
  },
  {
    id: 'torn-paper',
    label: '07',
    name: '撕纸剪贴',
    count: '6 张照片 · 自由 / 纸张质感',
    rules: '完整参考固定 6 图关系：左上竖图、右上横图、中央横图、右中竖图、左下横图、右下横图。仅左上、右中、左下使用指定方向的撕纸蒙版；固定两处半透明胶带。',
  },
]

function ImageBlock({ className = '', torn = '', src }) {
  return <span className={`master-photo ${torn ? `master-photo--torn-${torn}` : ''} ${className}`} style={src ? { backgroundImage: `url("${src}")` } : undefined} />
}

function NeatGrid({ miniature = false, photos = [] }) {
  return (
    <div className={`master-sheet master-sheet--grid ${miniature ? 'master-sheet--mini' : ''}`}>
      <ImageBlock className="grid-1" src={photos[0]} />
      <ImageBlock className="grid-2" src={photos[1]} />
      <ImageBlock className="grid-3" src={photos[2]} />
      <ImageBlock className="grid-4" src={photos[3]} />
      <ImageBlock className="grid-5" src={photos[4]} />
      <ImageBlock className="grid-6" src={photos[5]} />
      <ImageBlock className="grid-7" src={photos[6]} />
    </div>
  )
}

function EditorialScatter({ miniature = false, photos = [] }) {
  return (
    <div className={`master-sheet master-sheet--editorial ${miniature ? 'master-sheet--mini' : ''}`}>
      <ImageBlock className="editorial-1" src={photos[0]} />
      <ImageBlock className="editorial-2" src={photos[1]} />
      <ImageBlock className="editorial-3" src={photos[2]} />
      <ImageBlock className="editorial-4" src={photos[3]} />
      <ImageBlock className="editorial-5" src={photos[4]} />
      <ImageBlock className="editorial-6" src={photos[5]} />
      <ImageBlock className="editorial-7" src={photos[6]} />
      <ImageBlock className="editorial-8" src={photos[7]} />
      <span className="editorial-kicker">A SMALL ARCHIVE / 01</span>
      <h2 className="editorial-title"><span>little</span><span>moments</span></h2>
      <span className="editorial-word editorial-word--left">some</span>
      <span className="editorial-word editorial-word--right">everyday</span>
    </div>
  )
}

function NeatGrow({ miniature = false, photos = [] }) {
  return (
    <div className={`master-sheet master-sheet--grow ${miniature ? 'master-sheet--mini' : ''}`}>
      <div className="grow-cluster">
        {Array.from({ length: 10 }, (_, index) => <ImageBlock key={index} className={`grow-${index + 1}`} src={photos[index]} />)}
      </div>
    </div>
  )
}

function EditorialCover({ miniature = false, photos = [] }) {
  return (
    <div className={`master-sheet master-sheet--editorial-cover ${miniature ? 'master-sheet--mini' : ''}`}>
      <h2 className="editorial-cover-title"><span>as</span><span>we</span><span>rise</span></h2>
      <p className="editorial-cover-subtitle">photography<br />from the<br />memory archive</p>
      {Array.from({ length: 10 }, (_, index) => <ImageBlock key={index} className={`cover-${index + 1}`} src={photos[index]} />)}
      <span className="editorial-cover-credit">APERTURE / 01</span>
    </div>
  )
}

function PrintWall({ miniature = false, photos = [] }) {
  return (
    <div className={`master-sheet master-sheet--print-wall ${miniature ? 'master-sheet--mini' : ''}`}>
      {Array.from({ length: 9 }, (_, index) => <span key={index} className={`paper-print wall-print-${index + 1}`}><ImageBlock src={photos[index]} /></span>)}
    </div>
  )
}

function PrintStack({ miniature = false, photos = [] }) {
  return (
    <div className={`master-sheet master-sheet--prints ${miniature ? 'master-sheet--mini' : ''}`}>
      {Array.from({ length: 6 }, (_, index) => <span key={index} className={`paper-print print-${index + 1}`}><ImageBlock src={photos[index]} /></span>)}
      <span className="print-tape print-tape-1" />
      <span className="print-tape print-tape-2" />
    </div>
  )
}

function TornPaper({ miniature = false, photos = [] }) {
  return (
    <div className={`master-sheet master-sheet--torn ${miniature ? 'master-sheet--mini' : ''}`}>
      <ImageBlock className="torn-1" torn="left" src={photos[0]} />
      <ImageBlock className="torn-2" src={photos[1]} />
      <ImageBlock className="torn-3" src={photos[2]} />
      <ImageBlock className="torn-4" torn="right" src={photos[3]} />
      <ImageBlock className="torn-5" torn="bottom" src={photos[4]} />
      <ImageBlock className="torn-6" src={photos[5]} />
      <span className="tape tape-1" />
      <span className="tape tape-2" />
    </div>
  )
}

export const BOARDS = {
  'neat-grid': NeatGrid,
  'neat-grow': NeatGrow,
  'editorial-scatter': EditorialScatter,
  'editorial-cover': EditorialCover,
  'print-wall': PrintWall,
  'print-stack': PrintStack,
  'torn-paper': TornPaper,
}

function PrototypeSwitcher({ activeId, onChange }) {
  const activeIndex = VARIANTS.findIndex((item) => item.id === activeId)
  const previous = VARIANTS[(activeIndex - 1 + VARIANTS.length) % VARIANTS.length]
  const next = VARIANTS[(activeIndex + 1) % VARIANTS.length]
  const active = VARIANTS[activeIndex]

  return (
    <nav className="prototype-switcher" aria-label="切换母板">
      <button type="button" onClick={() => onChange(previous.id)} aria-label="上一张母板">←</button>
      <span>{active.label} · {active.name}</span>
      <button type="button" onClick={() => onChange(next.id)} aria-label="下一张母板">→</button>
    </nav>
  )
}

export default function CollageMastersPrototype() {
  const params = new URLSearchParams(window.location.search)
  const initial = VARIANTS.some((item) => item.id === params.get('variant'))
    ? params.get('variant')
    : 'neat-grid'
  const [activeId, setActiveId] = useState(initial)
  const active = VARIANTS.find((item) => item.id === activeId)

  const changeVariant = (id) => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set('prototype', 'collage-masters')
    nextParams.set('variant', id)
    window.history.replaceState(null, '', `?${nextParams.toString()}`)
    setActiveId(id)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = VARIANTS.findIndex((item) => item.id === activeId)
      const nextIndex = event.key === 'ArrowLeft'
        ? (index - 1 + VARIANTS.length) % VARIANTS.length
        : (index + 1) % VARIANTS.length
      changeVariant(VARIANTS[nextIndex].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeId])

  const Board = BOARDS[activeId]
  return (
    <main className="masters-prototype">
      <header className="masters-prototype__header">
        <p>PROTOTYPE · 拼贴布局验证</p>
        <h1>{active.name}</h1>
        <span>{active.count}</span>
      </header>

      <section className="masters-prototype__stage">
        <Board />
      </section>

      <aside className="masters-prototype__rules">
        <span>母板规则</span>
        <p>{active.rules}</p>
      </aside>

      <PrototypeSwitcher activeId={activeId} onChange={changeVariant} />
    </main>
  )
}
