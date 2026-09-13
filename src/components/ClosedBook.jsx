import { Cover } from './AlbumPage.jsx'
import './closed-book.css'

// 合着的书：封面 + 露出的纸边 + 投影。点一下翻开（进阅读，直接落在第一页内容）。
// 复用阅读里那一套封面设计（书名 + 由种子定的配色），所以这里不需要加载任何照片。
export default function ClosedBook({ album, onOpen }) {
  const pageStyle = { '--page-ratio': album.format.pageRatio }
  return (
    <div
      className="closed-book"
      role="button"
      tabIndex={0}
      aria-label="翻开这本书"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="closed-book__stack">
        <div className="closed-book__pages" aria-hidden="true" />
        <div className="closed-book__cover" style={pageStyle}>
          <Cover album={album} />
        </div>
      </div>
      <p className="closed-book__hint">点一下翻开</p>
    </div>
  )
}
