// 书库持久化：用 IndexedDB 存每一本书（元数据 + preview 图）。
// 渲染层只用 previewSrc（loadPhoto 里画到 canvas 再导出的 JPEG data URL），
// 所以原图不必存——12 张大约几 MB，IndexedDB 完全放得下。
// 所有失败都「软着陆」：存不下就当作没有持久化，应用照常能用。
import { getPageFormat } from './pageFormat.js'
import { pickCoverColor } from './palette.js'

const DB_NAME = 'albummm'
const DB_VERSION = 1
const STORE = 'books'

export function isSupported() {
  return typeof indexedDB !== 'undefined'
}

// 只留可序列化的字段，派生数据（pages / photosById）不写库
export function toRecord(book) {
  return {
    id: String(book.id),
    title: String(book.title ?? ''),
    style: String(book.style ?? 'gallery'),
    formatId: String(book.formatId ?? 'portrait'),
    seed: Number(book.seed) || 0,
    createdAt: Number(book.createdAt) || Date.now(),
    photos: (book.photos ?? []).map((photo) => ({
      id: String(photo.id),
      name: String(photo.name ?? ''),
      width: Number(photo.width) || 0,
      height: Number(photo.height) || 0,
      orientation: photo.orientation,
      previewSrc: String(photo.previewSrc ?? ''),
    })),
  }
}

// 读回来时防脏数据：字段缺失就直接丢掉这本，别让整个书架挂掉
export function fromRecord(record) {
  if (!record || !record.id || !Array.isArray(record.photos) || record.photos.length === 0) {
    return null
  }
  if (record.photos.some((photo) => !photo || !photo.id || !photo.previewSrc)) return null
  const base = toRecord(record)
  return {
    ...base,
    // 书架画封面要用到的两个派生字段
    pageRatio: getPageFormat(base.formatId).pageRatio,
    coverColor: pickCoverColor(base.seed),
    photos: base.photos,
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error('IndexedDB 不可用'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('打开书库失败'))
  })
}

function tx(db, mode, run) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const store = transaction.objectStore(STORE)
    let result
    try {
      result = run(store)
    } catch (error) {
      reject(error)
      return
    }
    transaction.oncomplete = () => resolve(result?.result ?? result)
    transaction.onerror = () => reject(transaction.error ?? new Error('书库操作失败'))
    transaction.onabort = () => reject(transaction.error ?? new Error('书库操作中止'))
  })
}

export async function loadBooks() {
  try {
    const db = await openDb()
    const records = await tx(db, 'readonly', (store) => store.getAll())
    db.close()
    if (!Array.isArray(records)) return []
    return records
      .map(fromRecord)
      .filter(Boolean)
      .sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return [] // 无痕模式 / 配额 / 脏数据：当作没有书库
  }
}

export async function saveBook(book) {
  try {
    const db = await openDb()
    await tx(db, 'readwrite', (store) => store.put(toRecord(book)))
    db.close()
    return true
  } catch {
    return false
  }
}

export async function deleteBook(id) {
  try {
    const db = await openDb()
    await tx(db, 'readwrite', (store) => store.delete(String(id)))
    db.close()
    return true
  } catch {
    return false
  }
}
