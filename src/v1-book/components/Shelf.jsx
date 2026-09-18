import { Cover } from './AlbumPage.jsx'
import './shelf.css'

// 封面墙：书平铺、封面朝前（不是书脊朝外立着的传统书架）。
// 网格原点固定在左上，列数随书数变：一本时占满一整排（封面放大些），两本及以后两列。
// 封面卡片只用书名 + 种子配色就能画，不需要加载照片。
export default function Shelf({ books, onOpen, onNew }) {
  const columns = Math.min(Math.max(books.length, 1), 2)
  const coverAlbumOf = (book) => ({
    title: book.title,
    coverColor: book.coverColor,
    format: { pageRatio: book.pageRatio },
  })
  return (
    <div className="shelf">
      <div className="shelf__grid" style={{ '--shelf-columns': columns }}>
        {books.map((book) => (
          <button
            key={book.id}
            type="button"
            className="shelf__cell"
            onClick={() => onOpen(book)}
          >
            <span className="shelf__book">
              <Cover album={coverAlbumOf(book)} />
            </span>
          </button>
        ))}
        <button type="button" className="shelf__cell shelf__cell--new" onClick={onNew}>
          <span className="shelf__plus" aria-hidden="true">＋</span>
          <span className="shelf__new-label">新建一本</span>
        </button>
      </div>
      <p className="shelf__hint">点一本书拿起来</p>
    </div>
  )
}
