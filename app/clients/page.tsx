'use client';

import { useCallback, useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, EmptyState, PageHeader } from '@/components/Card';
import { Button, Modal } from '@/components/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Client } from '@/lib/types';

type FormData = Omit<Client, 'id' | 'createdAt'>;

const emptyForm = (): FormData => ({
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
});

export default function ClientsPage() {
  const { ready, settings, clients, transactions, invoices, addClient, updateClient, deleteClient } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const clientStats = useMemo(() => {
    const stats: Record<string, { income: number; costs: number; invoiceCount: number }> = {};
    for (const c of clients) {
      const txs = transactions.filter((t) => t.clientId === c.id);
      const invs = invoices.filter((i) => i.clientId === c.id);
      stats[c.id] = {
        income: txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        costs: txs.filter((t) => t.type === 'cost').reduce((s, t) => s + t.amount, 0),
        invoiceCount: invs.length,
      };
    }
    return stats;
  }, [clients, transactions, invoices]);

  const sym = settings.currencySymbol || '$';

  const openNew = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((c: Client) => {
    setEditing(c);
    setModalOpen(true);
  }, []);

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        actions={<Button onClick={openNew}><PlusIcon /> Add Client</Button>}
      />

      {clients.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={clients.length === 0 ? 'No clients yet' : 'No matching clients'}
          description={clients.length === 0 ? 'Add your first client to start tracking work' : 'Try a different search term'}
          action={clients.length === 0 ? <Button onClick={openNew} size="sm">Add Client</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const stat = clientStats[c.id] ?? { income: 0, costs: 0, invoiceCount: 0 };
            return (
              <Card key={c.id} className="cursor-pointer transition-shadow hover:shadow-md">
                <div onClick={() => openEdit(c)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</h3>
                      {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                      {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${c.name}?`)) deleteClient(c.id);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <div className="mt-3 flex gap-4 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Income: {formatCurrency(stat.income, sym)}
                    </span>
                    <span className="text-slate-500">
                      {stat.invoiceCount} invoice{stat.invoiceCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Added {formatDate(c.createdAt)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSave={(data) => {
          if (editing) {
            updateClient({ ...editing, ...data });
          } else {
            addClient(data);
          }
          setModalOpen(false);
        }}
      />
    </>
  );
}

function ClientModal({
  open,
  onClose,
  editing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: Client | null;
  onSave: (data: FormData) => void;
}) {
  const [form, setForm] = useState<FormData>(emptyForm);

  useMemo(() => {
    if (open) {
      if (editing) {
        setForm({ name: editing.name, email: editing.email, phone: editing.phone, address: editing.address, notes: editing.notes });
      } else {
        setForm(emptyForm());
      }
    }
  }, [open, editing]);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onSave(form);
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Client' : 'New Client'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Name *</span>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            placeholder="Client or company name" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</span>
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Address</span>
          <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
        </label>
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
          <button type="submit" disabled={!form.name}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50">
            {editing ? 'Save Changes' : 'Add Client'}
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
