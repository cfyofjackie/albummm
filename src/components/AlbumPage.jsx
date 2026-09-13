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
  const { layoutId, side, imageIds, boxes = [], flipPair } = page.studio
  const photosById = album.photosById
  const canvasClass = `studio-canvas studio-canvas--${side}`

  // 一张图横跨两页的三种做法：满版（仅在裁切可忽略时）、超宽横幅（完整不裁）、
  // 跨页留白 T2（四周等宽白边）——比例不够接近满版时就走 T2，宁可留白也不裁图。
  if (layoutId === 'studio-hero' || layoutId === 'studio-panorama' || layoutId === 'studio-inset') {
    const photo = photosById[imageIds[0]]
    const boxClass = layoutId === 'studio-hero'
      ? 'hero'
      : layoutId === 'studio-panorama' ? 'panorama' : 'inset'
    // T2 的框由排版引擎算好（四边等宽内缩）；hero / panorama 铺满整张画布。
    const box = boxes[0]
    const boxStyle = box
      ? {
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.w}%`,
        height: `${box.h}%`,
      }
      : undefined
    return (
      <div
        className={`album-page album-page--studio ${layoutId === 'studio-hero' ? 'album-page--bleed' : ''}`}
        style={pageStyle}
      >
        <div className={canvasClass}>
          <figure
            className={`imgbox studio-box studio-box--${boxClass}`}
            style={boxStyle}
            data-photo-id={imageIds[0]}
          >
            <img src={photo.previewSrc} alt="" />
          </figure>
        </div>
      </div>
    )
  }

  if (layoutId === 'studio-triptych') {
    return (
      <div className="album-page album-page--studio" style={pageStyle}>
        <div className={canvasClass}>
          {boxes.map((box) => (
            <figure
              key={box.photoId}
              className="imgbox studio-box studio-box--triptych"
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

  const photoIndex = flipPair ? (side === 'left' ? 1 : 0) : side === 'left' ? 0 : 1
  const photo = photosById[imageIds[photoIndex]]
  return (
    <div className="album-page album-page--studio" style={pageStyle}>
      <figure className="imgbox studio-pair-photo" data-photo-id={photo.id}>
        <img src={photo.previewSrc} alt="" />
      </figure>
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
