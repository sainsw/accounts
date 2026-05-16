import type { AuditLogEntry } from './types';
import { addAuditEntry } from './indexeddb';

export function logAudit(
  action: AuditLogEntry['action'],
  entityType: AuditLogEntry['entityType'],
  entityId: string,
  before: unknown,
  after: unknown
): void {
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    before,
    after,
  };
  addAuditEntry(entry).catch(() => {});
}

export function describeAuditAction(entry: AuditLogEntry): string {
  const verb = entry.action === 'create' ? 'Created' : entry.action === 'update' ? 'Updated' : 'Deleted';
  const entity = entry.entityType.charAt(0).toUpperCase() + entry.entityType.slice(1);
  return `${verb} ${entity}`;
}

export function getEntityLabel(entry: AuditLogEntry): string {
  const after = entry.after as Record<string, unknown> | null;
  const before = entry.before as Record<string, unknown> | null;
  const data = after || before;
  if (!data) return entry.entityId;
  return (data.description || data.name || data.invoiceNumber || data.businessName || entry.entityId) as string;
}
