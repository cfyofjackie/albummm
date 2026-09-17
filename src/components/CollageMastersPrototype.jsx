import { useEffect, useState } from 'react'
import { buildJustifiedCollage, JUSTIFIED_PAGE_HEIGHT } from '../lib/justifiedCollage.js'
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

function photoSource(photo) {
  return typeof photo === 'string' ? photo : photo?.src
}

function photoOrientation(photo) {
  if (typeof photo === 'string' || !photo) return 'portrait'
  return photo.orientation || 'portrait'
}

function arrangePhotos(photos, slotAspects) {
  if (!photos.length) return photos
  const first = photos[0]
  const remaining = photos.slice(1)
  return slotAspects.map((slotAspect, index) => {
    if (index === 0) return first
    if (!remaining.length) return undefined
    const nextIndex = remaining.reduce((bestIndex, photo, candidateIndex) => {
      const bestDistance = Math.abs(Math.log((remaining[bestIndex].aspect || .75) / slotAspect))
      const candidateDistance = Math.abs(Math.log((photo.aspect || .75) / slotAspect))
      return candidateDistance < bestDistance ? candidateIndex : bestIndex
    }, 0)
    return remaining.splice(nextIndex, 1)[0]
  })
}

export function arrangePhotosForBoard(boardId, photos) {
  if (!photos.length) return photos
  if (boardId === 'neat-grid') {
    const mainOrientation = photoOrientation(photos[0])
    return arrangePhotos(photos, [mainOrientation === 'landscape' ? 2 : .75, .67, .67, 1.73, 1.73, 1.75, 1.75])
  }
  if (boardId === 'neat-grow') return arrangePhotos(photos, [1, .7, .55, 1.5, 2.2, .85, .55, 1, .55, 1.35])
  if (boardId === 'editorial-scatter') return arrangePhotos(photos, [.8, .75, .75, 1, .75, .85, .75, .7])
  if (boardId === 'editorial-cover') return arrangePhotos(photos, [1.55, .75, .65, .7, 1.5, 1.5, 1.2, .8, 1, 1.45])
  if (boardId === 'print-wall') return arrangePhotos(photos, [.9, .9, .9, .9, .9, .9, .9, .9, .9])
  if (boardId === 'print-stack') return arrangePhotos(photos, [1.35, 1.4, 1.8, 1.2, 1.1, 1.4])
  return arrangePhotos(photos, [.8, 1.7, 1.9, .9, 2, 2.25])
}

function ImageBlock({ className = '', torn = '', src, style }) {
  const image = photoSource(src)
  return <span className={`master-photo master-photo--${photoOrientation(src)} ${torn ? `master-photo--torn-${torn}` : ''} ${className}`} style={{ ...style, ...(image ? { backgroundImage: `url("${image}")` } : {}) }} />
}

function FluidPrint({ className, photo }) {
  return <span className={`paper-print paper-print--fluid ${className}`} style={{ '--photo-aspect': photo?.aspect || .75 }}><ImageBlock src={photo} /></span>
}

function NeatGrid({ miniature = false, photos = [] }) {
  const mainOrientation = photoOrientation(photos[0])
  const tiles = buildJustifiedCollage(photos)
  if (tiles.length) {
    return (
      <div className={`master-sheet master-sheet--grid master-sheet--grid-fluid ${miniature ? 'master-sheet--mini' : ''}`}>
        {tiles.map((tile, index) => <ImageBlock key={tile.photo.src || index} className="grid-fluid-tile" src={tile.photo} style={{ left: `${tile.x}%`, top: `${tile.y / JUSTIFIED_PAGE_HEIGHT * 100}%`, width: `${tile.width}%`, height: `${tile.height / JUSTIFIED_PAGE_HEIGHT * 100}%` }} />)}
      </div>
    )
  }
  const arranged = arrangePhotosForBoard('neat-grid', photos)
  return (
    <div className={`master-sheet master-sheet--grid master-sheet--grid-main-${mainOrientation} ${miniature ? 'master-sheet--mini' : ''}`}>
      {Array.from({ length: 7 }, (_, index) => <ImageBlock key={index} className={`grid-${index + 1}`} src={arranged[index]} />)}
    </div>
  )
}

function EditorialScatter({ miniature = false, photos = [] }) {
  const arranged = arrangePhotosForBoard('editorial-scatter', photos)
  return (
    <div className={`master-sheet master-sheet--editorial ${miniature ? 'master-sheet--mini' : ''}`}>
      {Array.from({ length: 8 }, (_, index) => <ImageBlock key={index} className={`editorial-${index + 1}`} src={arranged[index]} />)}
      <span className="editorial-kicker">A SMALL ARCHIVE / 01</span>
      <h2 className="editorial-title"><span>little</span><span>moments</span></h2>
      <span className="editorial-word editorial-word--left">some</span>
      <span className="editorial-word editorial-word--right">everyday</span>
    </div>
  )
}

function NeatGrow({ miniature = false, photos = [] }) {
  const arranged = arrangePhotosForBoard('neat-grow', photos)
  return (
    <div className={`master-sheet master-sheet--grow ${miniature ? 'master-sheet--mini' : ''}`}>
      <div className="grow-cluster">
        {Array.from({ length: 10 }, (_, index) => <ImageBlock key={index} className={`grow-${index + 1}`} src={arranged[index]} />)}
      </div>
    </div>
  )
}

function EditorialCover({ miniature = false, photos = [] }) {
  const arranged = arrangePhotosForBoard('editorial-cover', photos)
  return (
    <div className={`master-sheet master-sheet--editorial-cover ${miniature ? 'master-sheet--mini' : ''}`}>
      <h2 className="editorial-cover-title"><span>as</span><span>we</span><span>rise</span></h2>
      <p className="editorial-cover-subtitle">photography<br />from the<br />memory archive</p>
      {Array.from({ length: 10 }, (_, index) => <ImageBlock key={index} className={`cover-${index + 1}`} src={arranged[index]} />)}
      <span className="editorial-cover-credit">APERTURE / 01</span>
    </div>
  )
}

function PrintWall({ miniature = false, photos = [] }) {
  const arranged = arrangePhotosForBoard('print-wall', photos)
  if (photos.length) {
    return (
      <div className={`master-sheet master-sheet--print-wall master-sheet--print-wall-fluid ${miniature ? 'master-sheet--mini' : ''}`}>
        <span className="print-wall-fluid-grid">{arranged.map((photo, index) => <FluidPrint key={photo.src || index} className="wall-print-fluid" photo={photo} />)}</span>
      </div>
    )
  }
  return (
    <div className={`master-sheet master-sheet--print-wall ${miniature ? 'master-sheet--mini' : ''}`}>
      {Array.from({ length: 9 }, (_, index) => <span key={index} className={`paper-print wall-print-${index + 1}`}><ImageBlock src={arranged[index]} /></span>)}
    </div>
  )
}

function PrintStack({ miniature = false, photos = [] }) {
  const arranged = arrangePhotosForBoard('print-stack', photos)
  if (photos.length) {
    return (
      <div className={`master-sheet master-sheet--prints master-sheet--prints-fluid ${miniature ? 'master-sheet--mini' : ''}`}>
        {Array.from({ length: 6 }, (_, index) => <FluidPrint key={arranged[index]?.src || index} className={`print-${index + 1}`} photo={arranged[index]} />)}
        <span className="print-tape print-tape-1" />
        <span className="print-tape print-tape-2" />
      </div>
    )
  }
  return (
    <div className={`master-sheet master-sheet--prints ${miniature ? 'master-sheet--mini' : ''}`}>
      {Array.from({ length: 6 }, (_, index) => <span key={index} className={`paper-print print-${index + 1}`}><ImageBlock src={arranged[index]} /></span>)}
      <span className="print-tape print-tape-1" />
      <span className="print-tape print-tape-2" />
    </div>
  )
}

function TornPaper({ miniature = false, photos = [] }) {
  const arranged = arrangePhotosForBoard('torn-paper', photos)
  return (
    <div className={`master-sheet master-sheet--torn ${miniature ? 'master-sheet--mini' : ''}`}>
      <ImageBlock className="torn-1" torn="left" src={arranged[0]} />
      <ImageBlock className="torn-2" src={arranged[1]} />
      <ImageBlock className="torn-3" src={arranged[2]} />
      <ImageBlock className="torn-4" torn="right" src={arranged[3]} />
      <ImageBlock className="torn-5" torn="bottom" src={arranged[4]} />
      <ImageBlock className="torn-6" src={arranged[5]} />
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
