import { boxesForPage } from '../lib/geometry.js'
import './album.css'

function Cover({ album, back }) {
  const color = album.coverColor
  return (
    <div
      className={`album-page album-page--cover ${color.dark ? 'cover--dark' : 'cover--light'}`}
      style={{ background: color.hex, '--page-ratio': album.format.pageRatio }}
    >
      <div className={`cover__title ${back ? 'cover__title--small' : ''}`}>{album.title}</div>
    </div>
  )
}

function StudioSpreadPage({ page, album, pageStyle }) {
  const { layoutId, side, imageIds, boxes = [] } = page.studio
  const photosById = album.photosById
  const canvasClass = `studio-canvas studio-canvas--${side}`

  // 题名页要排文字，保留专属渲染；其余 studio 版式一律「画布 + 盒子列表」：
  // 盒子由排版引擎算好（位置尺寸 + fit），这里只负责画。
  // 这样新增模板只需要在 plan.js 里加一个盒子构造函数，渲染层不用改——
  // 一页放一张 / 一页放两张 / 左右不同模块，都是同一套盒子。
  if (layoutId === 'studio-title-photo') {
    const photo = photosById[imageIds[0]]
    return (
      <div className="album-page album-page--studio" style={pageStyle}>
        {side === 'left' ? (
          <div className="studio-title">
            <span className="studio-title__eyebrow">A PHOTOGRAPHIC EDITION</span>
            <span className="studio-title__text">{album.title}</span>
          </div>
        ) : (
          <figure className="imgbox studio-title-photo" data-photo-id={imageIds[0]}>
            <img src={photo.previewSrc} alt="" />
          </figure>
        )}
      </div>
    )
  }

  return (
    <div
      className={`album-page album-page--studio ${layoutId === 'studio-hero' ? 'album-page--bleed' : ''}`}
      style={pageStyle}
    >
      <div className={canvasClass}>
        {boxes.map((box) => (
          <figure
            key={box.photoId}
            className={`imgbox studio-box studio-box--${box.fit === 'cover' ? 'cover' : 'contain'}${box.plate ? ' studio-box--plate' : ''}`}
            data-photo-id={box.photoId}
            style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
          >
            <img src={photosById[box.photoId].previewSrc} alt="" />
          </figure>
        ))}
      </div>
    </div>
  )
}

export default function AlbumPage({ page, album }) {
  const pageStyle = { '--page-ratio': album.format.pageRatio }
  if (page.type === 'blank') return <div className="album-page album-page--blank" style={pageStyle} aria-hidden="true" />
  if (page.type === 'cover') return <Cover album={album} />
  if (page.type === 'back') return <Cover album={album} back />
  if (page.type === 'studio') return <StudioSpreadPage page={page} album={album} pageStyle={pageStyle} />

  const photosById = album.photosById
  const boxes = boxesForPage(page, photosById)

  return (
    <div
      className={`album-page style-${album.style} ${page.layoutId === 'single-full' ? 'album-page--bleed' : ''}`}
      style={pageStyle}
    >
      <div className="page-area">
        {boxes.map((b) => (
          <figure
            key={b.photoId}
            className={`imgbox ${page.layoutId === 'single-full' ? 'imgbox--cover' : ''}`}
            data-photo-id={b.photoId}
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
            }}
          >
            <img src={photosById[b.photoId].previewSrc} alt="" />
          </figure>
        ))}
      </div>
    </div>
  )
}
