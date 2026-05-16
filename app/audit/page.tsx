'use client';

import { useEffect, useState } from 'react';
import { Card, PageHeader } from '@/components/Card';
import { getAuditLog } from '@/lib/indexeddb';
import { describeAuditAction, getEntityLabel } from '@/lib/audit';
import type { AuditLogEntry } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    getAuditLog(pageSize, page * pageSize)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <PageHeader title="Activity Log" description="All changes made to your data" />

      <Card>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No activity recorded yet. Changes will appear here as you use the app.</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {describeAuditAction(entry)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {getEntityLabel(entry)} &middot; {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    entry.action === 'create' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' :
                    entry.action === 'update' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                    'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                  }`}>
                    {entry.action}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">
                Previous
              </button>
              <span className="text-xs text-slate-500 self-center">Page {page + 1}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={entries.length < pageSize} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">
                Next
              </button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
