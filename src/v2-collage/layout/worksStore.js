// Small device-only archive for completed prototype pages.
const DB_NAME = 'albummm-pages'
const STORE_NAME = 'works'

function database() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact(mode, action) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const request = action(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => reject(transaction.error)
  })
}

export const worksStore = {
  list: () => transact('readonly', (store) => store.getAll()),
  put: (work) => transact('readwrite', (store) => store.put(work)),
  remove: (id) => transact('readwrite', (store) => store.delete(id)),
}
