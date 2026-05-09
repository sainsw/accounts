'use client';

import { useCallback, useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, EmptyState, PageHeader } from '@/components/Card';
import { Button, Modal } from '@/components/Modal';
import { cn, formatCurrency, formatDate, todayString } from '@/lib/utils';
import type { Transaction, TransactionType } from '@/lib/types';

type FormData = Omit<Transaction, 'id'>;

const emptyForm = (): FormData => ({
  date: todayString(),
  type: 'cost',
  amount: 0,
  description: '',
  category: '',
  clientId: null,
  invoiceId: null,
  notes: '',
});

export default function TransactionsPage() {
  const { ready, settings, transactions, clients, addTransaction, updateTransaction, deleteTransaction } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<'all' | TransactionType>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filtered = useMemo(() => {
    let list = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
    if (filter !== 'all') list = list.filter((t) => t.type === filter);
    if (categoryFilter) list = list.filter((t) => t.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, filter, categoryFilter, search]);

  const allCategories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category).filter(Boolean));
    return [...cats].sort();
  }, [transactions]);

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const costs = filtered.filter((t) => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
    return { income, costs, net: income - costs };
  }, [filtered]);

  const sym = settings.currencySymbol || '$';

  const openNew = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((t: Transaction) => {
    setEditing(t);
    setModalOpen(true);
  }, []);

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Transactions"
        description={`${transactions.length} total transactions`}
        actions={
          <Button onClick={openNew}>
            <PlusIcon />
            Add Transaction
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
          />
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600">
            {(['all', 'income', 'cost'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium capitalize transition-colors first:rounded-l-lg last:rounded-r-lg',
                  filter === f
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-xs dark:border-slate-600"
          >
            <option value="">All categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="ml-auto flex gap-4 text-xs font-medium">
            <span className="text-emerald-600">Income: {formatCurrency(totals.income, sym)}</span>
            <span className="text-red-600">Costs: {formatCurrency(totals.costs, sym)}</span>
            <span className={totals.net >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              Net: {formatCurrency(totals.net, sym)}
            </span>
          </div>
        </div>
      </Card>

      {/* Transaction List */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No transactions"
          description={transactions.length === 0 ? 'Add your first transaction to get started' : 'No transactions match your filters'}
          action={
            transactions.length === 0 ? (
              <Button onClick={openNew} size="sm">Add Transaction</Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-700">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filtered.map((t) => {
                  const client = t.clientId ? clients.find((c) => c.id === t.clientId) : null;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => openEdit(t)}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(t.date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {t.description}
                        {t.notes && <span className="ml-2 text-xs text-slate-400">{t.notes}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{client?.name ?? ''}</td>
                      <td className={cn(
                        'whitespace-nowrap px-4 py-3 text-right font-semibold',
                        t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, sym)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTransaction(t.id);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        settings={settings}
        clients={clients}
        onSave={(data) => {
          if (editing) {
            updateTransaction({ ...data, id: editing.id });
          } else {
            addTransaction(data);
          }
          setModalOpen(false);
        }}
      />
    </>
  );
}

function TransactionModal({
  open,
  onClose,
  editing,
  settings,
  clients,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: Transaction | null;
  settings: { incomeCategories: string[]; costCategories: string[]; currencySymbol: string };
  clients: { id: string; name: string }[];
  onSave: (data: FormData) => void;
}) {
  const [form, setForm] = useState<FormData>(emptyForm);

  const handleOpen = useCallback(() => {
    if (editing) {
      const { id: _, ...rest } = editing;
      setForm(rest);
    } else {
      setForm(emptyForm());
    }
  }, [editing]);

  // Reset form when modal opens
  useMemo(() => {
    if (open) handleOpen();
  }, [open, handleOpen]);

  const categories = (form.type === 'income' ? settings.incomeCategories : settings.costCategories) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.category) return;
    onSave(form);
  };

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Transaction' : 'New Transaction'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600">
          {(['income', 'cost'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                set('type', t);
                set('category', '');
              }}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium capitalize transition-colors first:rounded-l-lg last:rounded-r-lg',
                form.type === t
                  ? t === 'income'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-red-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Amount ({settings.currencySymbol})</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount || ''}
              onChange={(e) => set('amount', parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
              placeholder="0.00"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Description</span>
          <input
            type="text"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            placeholder="What was this for?"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Category</span>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            >
              <option value="">Select...</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Client</span>
            <select
              value={form.clientId ?? ''}
              onChange={(e) => set('clientId', e.target.value || null)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            >
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            placeholder="Optional notes"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!form.description || !form.amount || !form.category}>
            {editing ? 'Save Changes' : 'Add Transaction'}
          </Button>
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
