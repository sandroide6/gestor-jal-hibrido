import { openDB } from 'idb';

const DB_NAME = 'gestor-jal';
const DB_VERSION = 2;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // ── v1: stores originales ────────────────────────────
        if (oldVersion < 1) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('by_sync_status', 'syncStatus');
          docStore.createIndex('by_created_at', 'createdAt');

          const syncStore = db.createObjectStore('sync_queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          syncStore.createIndex('by_created_at', 'createdAt');

          db.createObjectStore('doc_types', { keyPath: 'id' });
          db.createObjectStore('config', { keyPath: 'key' });
        }

        // ── v2: caché offline de plantillas y perfil de usuario ─
        if (oldVersion < 2) {
          // Plantillas DOCX binarias — keyPath: id del tipo de documento
          if (!db.objectStoreNames.contains('templates')) {
            db.createObjectStore('templates', { keyPath: 'id' });
          }
          // Caché de datos de usuario: firma, perfil — keyPath: 'key' ('signature', 'profile')
          if (!db.objectStoreNames.contains('user_cache')) {
            db.createObjectStore('user_cache', { keyPath: 'key' });
          }
        }
      },
    });
  }
  return dbPromise;
}

// ── Sync Queue ────────────────────────────────────────────

export async function addToSyncQueue(operation, payload) {
  const db = await getDB();
  await db.add('sync_queue', {
    operation,
    payload,
    retries: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function getPendingSyncCount() {
  const db = await getDB();
  return db.count('sync_queue');
}

export async function clearSyncQueue() {
  const db = await getDB();
  await db.clear('sync_queue');
}

export async function getAllPendingSync() {
  const db = await getDB();
  return db.getAllFromIndex('sync_queue', 'by_created_at');
}

export async function removeSyncItem(id) {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

export async function incrementSyncRetry(id) {
  const db = await getDB();
  const item = await db.get('sync_queue', id);
  if (item) {
    item.retries = (item.retries || 0) + 1;
    await db.put('sync_queue', item);
  }
}

// ── Documents ─────────────────────────────────────────────

export async function saveDocument(doc) {
  const db = await getDB();
  await db.put('documents', doc);
}

export async function updateDocument(localId, updates) {
  const db = await getDB();
  const existing = await db.get('documents', localId);
  if (existing) {
    await db.put('documents', { ...existing, ...updates });
  }
}

export async function getDocuments() {
  const db = await getDB();
  return db.getAllFromIndex('documents', 'by_created_at');
}

export async function getDocument(id) {
  const db = await getDB();
  return db.get('documents', id);
}

// ── Doc Types ─────────────────────────────────────────────

export async function getCachedDocTypes() {
  const db = await getDB();
  return db.getAll('doc_types');
}

// ── Templates (caché offline de plantillas DOCX) ──────────

export async function cacheTemplate(docTypeId, arrayBuffer) {
  const db = await getDB();
  await db.put('templates', {
    id: docTypeId,
    data: arrayBuffer,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedTemplate(docTypeId) {
  const db = await getDB();
  return db.get('templates', docTypeId);
}

// ── User Cache (firma y perfil para modo offline) ─────────

export async function cacheUserData(key, value) {
  const db = await getDB();
  await db.put('user_cache', { key, ...value, cachedAt: new Date().toISOString() });
}

export async function getCachedUserData(key) {
  const db = await getDB();
  return db.get('user_cache', key);
}
