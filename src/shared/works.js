const DB_NAME = 'albummm-works'
const STORE = 'works'
export const MAX_WORKS = 10
let mutationQueue = Promise.resolve()

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction(mode, action) {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      let result
      tx.oncomplete = () => resolve(result)
      tx.onerror = (event) => reject(tx.error || event.target?.error || new Error('作品保存失败'))
      tx.onabort = () => reject(tx.error || new Error('保存已中止'))
      action(tx.objectStore(STORE), tx, (value) => { result = value })
    })
  } finally {
    db.close()
  }
}

export function newWorkId() {
  return globalThis.crypto?.randomUUID?.() || `work-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function listWorks() {
  await mutationQueue
  const records = await transaction('readonly', (store, _tx, done) => {
    const request = store.getAll()
    request.onsuccess = () => done(request.result)
  })
  return (records || []).filter((work) => work?.id && Array.isArray(work.photos))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadWork(id) {
  return transaction('readonly', (store, _tx, done) => {
    const request = store.get(id)
    request.onsuccess = () => done(request.result || null)
  })
}

export async function countWorks() {
  return transaction('readonly', (store, _tx, done) => {
    const request = store.count()
    request.onsuccess = () => done(request.result)
  })
}

function enqueueMutation(action) {
  const task = mutationQueue.then(action)
  mutationQueue = task.catch(() => {})
  return task
}

export function saveWork(work) {
  const put = (record) => transaction('readwrite', (store, tx) => {
    const existing = store.get(work.id)
    existing.onsuccess = () => {
      if (existing.result) { store.put(record); return }
      const count = store.count()
      count.onsuccess = () => {
        if (count.result >= MAX_WORKS) {
          tx.abort()
          return
        }
        store.put(record)
      }
    }
  })
  return enqueueMutation(async () => {
    try { return await put(work) }
    catch (error) {
      // Some WebKit builds cannot persist Blob/File values in IndexedDB. Byte arrays
      // use the same local database and can be reconstructed when opening a work.
      if (String(error).includes('Blob/File data')) return put(await workWithBytes(work, await loadWork(work.id)))
      throw error
    }
  }).catch(async (error) => {
    // A full library is distinct from browser quota failure in the UI.
    if (await countWorks().catch(() => 0) >= MAX_WORKS && !(await loadWork(work.id).catch(() => null))) {
      throw new Error(`本机最多保存 ${MAX_WORKS} 份作品，请先在“我的作品”删除一份。`)
    }
    throw error
  })
}

async function mediaBytes(value) {
  if (!(value instanceof Blob)) return value
  return { bytes: new Uint8Array(await value.arrayBuffer()), type: value.type, name: value.name, lastModified: value.lastModified }
}

async function workWithBytes(work, previous) {
  const previousPhotos = new Map((previous?.photos || []).map((photo) => [photo.id, photo.file]))
  const photos = []
  for (const photo of work.photos) {
    const existing = previousPhotos.get(photo.id)
    photos.push({ ...photo, file: existing?.bytes ? existing : await mediaBytes(photo.file) })
  }
  return { ...work, photos, thumbnail: await mediaBytes(work.thumbnail) }
}

export function mediaBlob(value) {
  if (value instanceof Blob) return value
  if (!value?.bytes) return null
  if (value.name) return new File([value.bytes], value.name, { type: value.type || '', lastModified: value.lastModified })
  return new Blob([value.bytes], { type: value.type || '' })
}

export function deleteWork(id) {
  return enqueueMutation(() => transaction('readwrite', (store) => { store.delete(id) }))
}

export function photoRecords(photos) {
  return photos.map(({ id, name, width, height, orientation, file }) => ({ id, name, width, height, orientation, file }))
}

export async function restorePhotos(records, loadPhoto) {
  return Promise.all(records.map(async (record) => {
    const file = mediaBlob(record.file)
    if (!file) throw new Error('作品缺少照片文件')
    const photo = await loadPhoto(file)
    return { ...photo, id: record.id, name: record.name }
  }))
}
