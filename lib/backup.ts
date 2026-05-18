import type { BackupData } from './types';
import { getAllAuditEntries, getAllAttachments, saveAttachment, type StoredAttachment } from './indexeddb';
import { STORAGE_KEYS } from './defaults';

const CURRENT_SCHEMA_VERSION = 1;
const APP_VERSION = '2.0.0';

export async function createBackup(): Promise<BackupData> {
  const load = <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const auditLog = await getAllAuditEntries().catch(() => []);
  const rawAttachments = await getAllAttachments().catch(() => []);
  // Convert ArrayBuffer data to base64 strings for JSON serialisation
  const attachments = rawAttachments.map((a) => ({
    id: a.id,
    transactionId: a.transactionId,
    name: a.name,
    mimeType: a.mimeType,
    data: typeof a.data === 'string' ? a.data : arrayBufferToBase64(a.data as ArrayBuffer),
  }));

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    settings: load(STORAGE_KEYS.settings, {}),
    transactions: load(STORAGE_KEYS.transactions, []),
    clients: load(STORAGE_KEYS.clients, []),
    invoices: load(STORAGE_KEYS.invoices, []),
    mileageEntries: load(STORAGE_KEYS.mileageEntries, []),
    wfhEntries: load(STORAGE_KEYS.wfhEntries, []),
    projects: load(STORAGE_KEYS.projects, []),
    assets: load(STORAGE_KEYS.assets, []),
    liabilities: load(STORAGE_KEYS.liabilities, []),
    budgets: load(STORAGE_KEYS.budgets, []),
    categorisationRules: load(STORAGE_KEYS.categorisationRules, []),
    auditLog,
    attachments,
  } as unknown as BackupData;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function restoreAttachments(data: BackupData): Promise<number> {
  const attachments = data.attachments || [];
  let count = 0;
  for (const a of attachments) {
    try {
      await saveAttachment({
        id: a.id,
        transactionId: a.transactionId,
        name: a.name,
        mimeType: a.mimeType,
        data: a.data,
      });
      count++;
    } catch {
      // Skip failed attachments
    }
  }
  return count;
}

export function downloadBackup(data: BackupData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `accounts-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function migrateBackup(data: unknown): BackupData {
  const raw = data as Record<string, unknown>;
  const version = (raw.schemaVersion as number) || 0;

  if (version === 0) {
    raw.schemaVersion = CURRENT_SCHEMA_VERSION;
    raw.mileageEntries = raw.mileageEntries || [];
    raw.wfhEntries = raw.wfhEntries || [];
    raw.projects = raw.projects || [];
    raw.assets = raw.assets || [];
    raw.liabilities = raw.liabilities || [];
    raw.budgets = raw.budgets || [];
    raw.categorisationRules = raw.categorisationRules || [];
    raw.auditLog = raw.auditLog || [];
  }

  return raw as unknown as BackupData;
}

export function validateBackup(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file format — expected a JSON object.' };
  }

  const raw = data as Record<string, unknown>;

  if (!Array.isArray(raw.transactions) && !Array.isArray(raw.clients) && !raw.settings) {
    return { valid: false, error: 'This doesn\'t look like an accounts backup file.' };
  }

  return { valid: true };
}

export function parseBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const validation = validateBackup(raw);
        if (!validation.valid) {
          reject(new Error(validation.error));
          return;
        }
        resolve(migrateBackup(raw));
      } catch {
        reject(new Error('Failed to parse backup file. Ensure it is valid JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}
