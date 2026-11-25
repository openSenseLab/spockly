import type { StateStorage } from 'zustand/middleware'

/**
 * Minimal IndexedDB key-value storage for zustand's persist middleware.
 * localStorage is capped at ~5 MB, which uploaded datasets exceed quickly.
 */
const DB_NAME = 'spockly'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

const openDb = () => {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const idbStorage: StateStorage = {
  getItem: async (key) => {
    try {
      return ((await withStore('readonly', (store) => store.get(key))) as string | undefined) ?? null
    } catch {
      return null
    }
  },
  setItem: async (key, value) => {
    try {
      await withStore('readwrite', (store) => store.put(value, key))
    } catch (error) {
      console.warn('spockly: could not save journal', error)
    }
  },
  removeItem: async (key) => {
    try {
      await withStore('readwrite', (store) => store.delete(key))
    } catch {
      // ignore
    }
  },
}
