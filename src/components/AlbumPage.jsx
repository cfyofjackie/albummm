import { boxesForPage } from '../lib/geometry.js'
import './album.css'

function Cover({ album, back }) {
  const color = album.coverColor
  return (
    <div
      className={`album-page album-page--cover ${color.dark ? 'cover--dark' : 'cover--light'}`}
      style={{ background: color.hex }}
    >
      <div className={`cover__title ${back ? 'cover__title--small' : ''}`}>{album.title}</div>
    </div>
  )
}

export default function AlbumPage({ page, album }) {
  if (page.type === 'blank') return <div className="album-page album-page--blank" aria-hidden="true" />
  if (page.type === 'cover') return <Cover album={album} />
  if (page.type === 'back') return <Cover album={album} back />

  const photosById = album.photosById
  const boxes = boxesForPage(page, photosById)

  return (
    <div className={`album-page style-${album.style}`}>
      <div className="page-area">
        {boxes.map((b) => (
          <figure
            key={b.photoId}
            className="imgbox"
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
