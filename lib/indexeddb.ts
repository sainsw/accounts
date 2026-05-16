const DB_NAME = 'accounts-db';
const DB_VERSION = 1;

const STORES = {
  attachments: 'attachments',
  auditLog: 'auditLog',
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.attachments)) {
        db.createObjectStore(STORES.attachments, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.auditLog)) {
        const store = db.createObjectStore(STORES.auditLog, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('entityType', 'entityType', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export type StoredAttachment = {
  id: string;
  transactionId: string;
  name: string;
  mimeType: string;
  data: ArrayBuffer | string;
};

export async function saveAttachment(attachment: StoredAttachment): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.attachments, 'readwrite');
    tx.objectStore(STORES.attachments).put(attachment);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAttachment(id: string): Promise<StoredAttachment | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.attachments, 'readonly');
    const request = tx.objectStore(STORES.attachments).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAttachmentsByTransaction(transactionId: string): Promise<StoredAttachment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.attachments, 'readonly');
    const store = tx.objectStore(STORES.attachments);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result as StoredAttachment[];
      resolve(all.filter((a) => a.transactionId === transactionId));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.attachments, 'readwrite');
    tx.objectStore(STORES.attachments).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllAttachments(): Promise<StoredAttachment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.attachments, 'readonly');
    const request = tx.objectStore(STORES.attachments).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

import type { AuditLogEntry } from './types';

export async function addAuditEntry(entry: AuditLogEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.auditLog, 'readwrite');
    tx.objectStore(STORES.auditLog).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAuditLog(limit: number = 100, offset: number = 0): Promise<AuditLogEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.auditLog, 'readonly');
    const store = tx.objectStore(STORES.auditLog);
    const index = store.index('timestamp');
    const entries: AuditLogEntry[] = [];
    let skipped = 0;

    const request = index.openCursor(null, 'prev');
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || entries.length >= limit) {
        resolve(entries);
        return;
      }
      if (skipped < offset) {
        skipped++;
        cursor.continue();
        return;
      }
      entries.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllAuditEntries(): Promise<AuditLogEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.auditLog, 'readonly');
    const request = tx.objectStore(STORES.auditLog).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearAuditLog(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.auditLog, 'readwrite');
    tx.objectStore(STORES.auditLog).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStorageUsage(): Promise<{ attachments: number; auditLog: number; localStorage: number }> {
  const db = await openDB();

  const getStoreSize = (storeName: string): Promise<number> =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => {
        const items = request.result;
        let size = 0;
        for (const item of items) {
          size += JSON.stringify(item).length;
        }
        resolve(size);
      };
      request.onerror = () => reject(request.error);
    });

  const [attachments, auditLog] = await Promise.all([
    getStoreSize(STORES.attachments),
    getStoreSize(STORES.auditLog),
  ]);

  let localStorage = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith('accounts.')) {
      localStorage += (window.localStorage.getItem(key) || '').length;
    }
  }

  return { attachments, auditLog, localStorage };
}
