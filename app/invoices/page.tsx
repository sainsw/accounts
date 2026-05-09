'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/Card';
import { Button, Modal } from '@/components/Modal';
import { cn, formatCurrency, formatDate, todayString } from '@/lib/utils';
import type { TrackedInvoice } from '@/lib/types';

type FormData = Omit<TrackedInvoice, 'id'>;

const emptyForm = (): FormData => ({
  invoiceNumber: '',
  clientId: null,
  clientName: '',
  issueDate: todayString(),
  dueDate: '',
  amount: 0,
  status: 'draft',
  paidDate: null,
  notes: '',
});

const STATUS_LABELS: Record<TrackedInvoice['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
};

const STATUS_COLORS: Record<TrackedInvoice['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesContent />
    </Suspense>
  );
}

function InvoicesContent() {
  const { ready, settings, invoices, clients, addInvoice, updateInvoice, deleteInvoice } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrackedInvoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | TrackedInvoice['status']>('');
  const [importData, setImportData] = useState<FormData | null>(null);
  const searchParams = useSearchParams();

  // Handle ?import= param from invoicer
  useEffect(() => {
    if (!ready) return;
    const raw = searchParams.get('import');
    if (!raw) return;
    try {
      const data = JSON.parse(atob(raw));
      const prefilled: FormData = {
        invoiceNumber: data.invoiceNumber || '',
        clientId: clients.find((c) => c.name === data.clientName)?.id ?? null,
        clientName: data.clientName || '',
        issueDate: data.issueDate || todayString(),
        dueDate: data.dueDate || '',
        amount: data.amount || 0,
        status: data.status || 'sent',
        paidDate: null,
        notes: '',
      };
      setImportData(prefilled);
      setEditing(null);
      setModalOpen(true);
      // Clean the URL without reloading
      window.history.replaceState({}, '', '/invoices');
    } catch {
      // Invalid import data, ignore
    }
  }, [ready, searchParams, clients]);

  const filtered = useMemo(() => {
    let list = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    if (statusFilter) list = list.filter((i) => i.status === statusFilter);
    return list;
  }, [invoices, statusFilter]);

  const stats = useMemo(() => {
    const total = invoices.reduce((s, i) => s + i.amount, 0);
    const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
    const overdue = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
    return { total, paid, outstanding, overdue };
  }, [invoices]);

  const sym = settings.currencySymbol || '$';

  const openNew = useCallback(() => { setEditing(null); setModalOpen(true); }, []);
  const openEdit = useCallback((i: TrackedInvoice) => { setEditing(i); setModalOpen(true); }, []);

  const markPaid = useCallback((inv: TrackedInvoice) => {
    updateInvoice({ ...inv, status: 'paid', paidDate: todayString() });
  }, [updateInvoice]);

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Track and manage your invoices"
        actions={<Button onClick={openNew}><PlusIcon /> New Invoice</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Invoiced" value={formatCurrency(stats.total, sym)} color="blue" />
        <StatCard label="Paid" value={formatCurrency(stats.paid, sym)} color="green" />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding, sym)} color="blue" />
        <StatCard label="Overdue" value={formatCurrency(stats.overdue, sym)} color="red" />
      </div>

      <div className="mb-4 flex gap-2">
        {(['', 'draft', 'sent', 'paid', 'overdue'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s
                ? 'bg-brand-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            {s ? STATUS_LABELS[s] : 'All'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={invoices.length === 0 ? 'No invoices tracked' : 'No matching invoices'}
          description={invoices.length === 0 ? 'Create invoices in the Invoice Builder, then track them here' : 'Try a different filter'}
          action={invoices.length === 0 ? <Button onClick={openNew} size="sm">Track Invoice</Button> : undefined}
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-700">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => openEdit(inv)}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.clientName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(inv.issueDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(inv.amount, sym)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[inv.status])}>
                        {STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markPaid(inv); }}
                            className="rounded px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteInvoice(inv.id); }}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <InvoiceModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setImportData(null); }}
        editing={editing}
        importData={importData}
        clients={clients}
        sym={sym}
        onSave={(data) => {
          setImportData(null);
          if (editing) updateInvoice({ ...data, id: editing.id });
          else addInvoice(data);
          setModalOpen(false);
        }}
      />
    </>
  );
}

function InvoiceModal({
  open,
  onClose,
  editing,
  importData,
  clients,
  sym,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: TrackedInvoice | null;
  importData: FormData | null;
  clients: { id: string; name: string }[];
  sym: string;
  onSave: (data: FormData) => void;
}) {
  const [form, setForm] = useState<FormData>(emptyForm);

  useMemo(() => {
    if (open) {
      if (importData) {
        setForm(importData);
      } else if (editing) {
        const { id: _, ...rest } = editing;
        setForm(rest);
      } else {
        setForm(emptyForm());
      }
    }
  }, [open, editing, importData]);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.invoiceNumber || !form.clientName || !form.amount) return;
    onSave(form);
  };

  return (
    <Modal open={open} onClose={onClose} title={importData ? 'Import from Invoicer' : editing ? 'Edit Invoice' : 'Track Invoice'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Invoice # *</span>
            <input type="text" value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
              placeholder="INV-001" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount ({sym}) *</span>
            <input type="number" step="0.01" min="0" value={form.amount || ''} onChange={(e) => set('amount', parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Client *</span>
          <div className="mt-1 flex gap-2">
            <select
              value={form.clientId ?? ''}
              onChange={(e) => {
                const c = clients.find((cl) => cl.id === e.target.value);
                set('clientId', c?.id ?? null);
                if (c) set('clientName', c.name);
              }}
              className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            >
              <option value="">Select or type name</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="text" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Client name"
              className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Issue Date</span>
            <input type="date" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Due Date</span>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value as TrackedInvoice['status'])}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>

        {form.status === 'paid' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Paid Date</span>
            <input type="date" value={form.paidDate ?? ''} onChange={(e) => set('paidDate', e.target.value || null)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</span>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
        </label>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button onClick={onClose} type="button"
            className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Cancel
          </button>
          <button type="submit" disabled={!form.invoiceNumber || !form.clientName || !form.amount}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50">
            {editing ? 'Save Changes' : 'Track Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}
