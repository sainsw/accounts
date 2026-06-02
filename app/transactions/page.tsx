'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import { Card, EmptyState, PageHeader } from '@/components/Card';
import { Button, Modal } from '@/components/Modal';
import { cn, formatCurrency, formatDate, todayString } from '@/lib/utils';
import { calculateVatAmount } from '@/lib/vat';
import { exportTransactionsCSV, downloadCsv } from '@/lib/export';
import { recognizeReceipt, type OcrResult, type OcrProgress } from '@/lib/receipt-ocr';

function ScanProgressBar({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/20">
        <div className="animate-scan-bar absolute inset-y-0 w-1/3 rounded-full bg-brand-500" />
      </div>
      <span className="text-xs text-brand-600 dark:text-brand-400">{label}</span>
    </div>
  );
}
import { suggestRuleFromRecategorisation } from '@/lib/smart-categorisation';
import { useUndo } from '@/lib/undo-context';
import type { Transaction, TransactionType, Attachment, CostCategoryMeta } from '@/lib/types';

type FormData = Omit<Transaction, 'id'>;

const emptyForm = (): FormData => ({
  date: todayString(),
  type: 'cost',
  amount: 0,
  description: '',
  category: '',
  clientId: null,
  invoiceId: null,
  projectId: null,
  notes: '',
  vatRate: null,
  vatAmount: 0,
  taxDeductible: true,
  attachments: [],
  currency: null,
  exchangeRate: null,
  originalAmount: null,
  recurrence: null,
  reconciliationStatus: 'unreconciled',
  importedFrom: null,
});

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsContent() {
  const { ready, settings, transactions, clients, invoices, addTransaction, updateTransaction, deleteTransaction, deleteInvoice, updateInvoice, categorisationRules, addRule } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const newHandled = useRef(false);
  const undoStack = useUndo();
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<Transaction | null>(null);
  const [ruleSuggestion, setRuleSuggestion] = useState<{ pattern: string; category: string; type: TransactionType; count: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<'all' | TransactionType | 'recurring' | 'unreconciled'>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
    if (filter === 'recurring') list = list.filter((t) => t.recurrence?.active);
    else if (filter === 'unreconciled') list = list.filter((t) => t.reconciliationStatus === 'unreconciled');
    else if (filter !== 'all') list = list.filter((t) => t.type === filter);
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
  const locale = settings.locale || 'en-US';

  const openNew = useCallback(() => { setEditing(null); setModalOpen(true); }, []);
  const openEdit = useCallback((t: Transaction) => { setEditing(t); setModalOpen(true); }, []);

  // Open the new-transaction form when arriving via the global "+ New" menu.
  useEffect(() => {
    if (!ready || newHandled.current) return;
    if (searchParams.get('new') === '1') {
      newHandled.current = true;
      setEditing(null);
      setModalOpen(true);
      router.replace('/transactions');
    }
  }, [ready, searchParams, router]);

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Transactions"
        description={`${transactions.length} total transactions`}
        actions={
          <div className="flex gap-2">
            {transactions.length > 0 && (
              <Button variant="secondary" onClick={() => {
                const csv = exportTransactionsCSV(filtered, settings);
                downloadCsv(csv, `transactions-${todayString()}.csv`);
              }}>
                Export CSV
              </Button>
            )}
            <Button onClick={openNew}>
              <PlusIcon />
              Add Transaction
            </Button>
          </div>
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
            {(['all', 'income', 'cost', 'recurring', 'unreconciled'] as const).map((f) => (
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
            className="rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600"
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

      {/* Rule suggestion banner */}
      {ruleSuggestion && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            You categorised this as &ldquo;{ruleSuggestion.category}&rdquo;. Create a rule so transactions containing &ldquo;{ruleSuggestion.pattern}&rdquo; are auto-categorised? ({ruleSuggestion.count} other matching transaction{ruleSuggestion.count !== 1 ? 's' : ''})
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                addRule({ pattern: ruleSuggestion.pattern, category: ruleSuggestion.category, type: ruleSuggestion.type });
                setRuleSuggestion(null);
              }}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              Create Rule
            </button>
            <button onClick={() => setRuleSuggestion(null)} className="text-xs text-blue-500 hover:text-blue-700">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-brand-50 px-4 py-2 dark:bg-brand-500/10">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{selected.size} selected</span>
          <button
            onClick={() => {
              selected.forEach((id) => {
                const tx = transactions.find((t) => t.id === id);
                if (tx && tx.reconciliationStatus !== 'reconciled') {
                  updateTransaction({ ...tx, reconciliationStatus: 'reconciled' });
                }
              });
              setSelected(new Set());
            }}
            className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300"
          >
            Reconcile Selected
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${selected.size} transaction(s)?`)) {
                selected.forEach((id) => deleteTransaction(id));
                setSelected(new Set());
              }
            }}
            className="rounded-lg bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300"
          >
            Delete Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700">
            Clear selection
          </button>
        </div>
      )}

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
                  <th className="w-8 px-2 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelected(new Set(filtered.map((t) => t.id)));
                        else setSelected(new Set());
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                  </th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  {settings.vatRegistered && <th className="px-4 py-3 text-right">VAT</th>}
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filtered.map((t) => {
                  const client = t.clientId ? clients.find((c) => c.id === t.clientId) : null;
                  const meta = (settings.costCategoryMeta || []).find((m) => m.name === t.category);
                  const isNonDeductible = t.type === 'cost' && t.taxDeductible === false;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => openEdit(t)}>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${t.description}`}
                          checked={selected.has(t.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(t.id);
                            else next.delete(t.id);
                            setSelected(next);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(t.date, locale)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {t.description}
                        {t.recurrence?.active && <span className="ml-1.5 inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" title={`Recurring ${t.recurrence.frequency}`}>↻</span>}
                        {t.notes && <span className="ml-2 text-xs text-slate-400">{t.notes}</span>}
                        {(t.attachments?.length || 0) > 0 && <span className="ml-1 text-xs text-slate-400" title={`${t.attachments.length} attachment(s)`}>📎</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          isNonDeductible
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                            : meta?.allowable === 'partial'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        )}>
                          {t.category}
                          {isNonDeductible && <span className="ml-1 text-[10px]">✗</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{client?.name ?? ''}</td>
                      <td className={cn(
                        'whitespace-nowrap px-4 py-3 text-right font-semibold',
                        t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, sym)}
                      </td>
                      {settings.vatRegistered && (
                        <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">
                          {t.vatRate !== null && t.vatRate !== undefined ? `${formatCurrency(t.vatAmount || 0, sym)}` : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTransaction({
                                ...t,
                                reconciliationStatus: t.reconciliationStatus === 'reconciled' ? 'unreconciled' : 'reconciled',
                              });
                            }}
                            title={t.reconciliationStatus === 'reconciled' ? 'Reconciled — click to unreconcile' : 'Unreconciled — click to reconcile'}
                            className={cn(
                              'rounded p-1 transition-colors',
                              t.reconciliationStatus === 'reconciled'
                                ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-400'
                            )}
                          >
                            <CheckCircleIcon />
                          </button>
                          {t.recurrence?.active && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTransaction({ ...t, recurrence: { ...t.recurrence!, active: false } });
                              }}
                              title="Stop recurrence"
                              className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-amber-500/10"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><rect x="3" y="3" width="10" height="10" rx="1" /></svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (t.invoiceId && invoices.some((inv) => inv.id === t.invoiceId)) {
                                setConfirmDeleteTx(t);
                              } else {
                                deleteTransaction(t.id);
                              }
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Delete transaction linked to invoice confirmation */}
      <Modal open={!!confirmDeleteTx} onClose={() => setConfirmDeleteTx(null)} title="Delete Transaction">
        {confirmDeleteTx && (() => {
          const linkedInvoice = invoices.find((inv) => inv.id === confirmDeleteTx.invoiceId);
          return (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This transaction is linked to invoice <span className="font-medium text-slate-900 dark:text-slate-100">#{linkedInvoice?.invoiceNumber}</span>.
                What would you like to do with the invoice?
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button onClick={() => setConfirmDeleteTx(null)} type="button"
                  className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (linkedInvoice) updateInvoice({ ...linkedInvoice, status: 'sent', paidDate: null });
                    deleteTransaction(confirmDeleteTx.id);
                    setConfirmDeleteTx(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Mark Invoice as Sent
                </button>
                <button
                  onClick={() => {
                    if (linkedInvoice) deleteInvoice(linkedInvoice.id);
                    deleteTransaction(confirmDeleteTx.id);
                    setConfirmDeleteTx(null);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
                >
                  Delete Both
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        settings={settings}
        clients={clients}
        onSave={(data) => {
          if (editing) {
            const prev = { ...editing };
            const updated = { ...data, id: editing.id };
            updateTransaction(updated);
            undoStack.push({
              description: `Edit "${data.description}"`,
              undo: () => updateTransaction(prev),
              redo: () => updateTransaction(updated),
            });
            // Suggest categorisation rule if category changed
            if (data.category !== editing.category) {
              const suggestion = suggestRuleFromRecategorisation(editing, data.category, transactions);
              if (suggestion) {
                setRuleSuggestion({ pattern: suggestion.pattern, category: data.category, type: data.type, count: suggestion.count });
              }
            }
          } else {
            addTransaction(data);
            undoStack.push({
              description: `Add "${data.description}"`,
              undo: () => {
                // Find and remove the most recently added matching transaction
                const match = transactions.find((t) => t.description === data.description && t.amount === data.amount && t.date === data.date);
                if (match) deleteTransaction(match.id);
              },
              redo: () => addTransaction(data),
            });
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
  settings: {
    incomeCategories: string[];
    costCategories: string[];
    currencySymbol: string;
    vatRegistered: boolean;
    costCategoryMeta?: CostCategoryMeta[];
    experimentalReceiptScanning?: boolean;
  };
  clients: { id: string; name: string }[];
  onSave: (data: FormData) => void;
}) {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [scanLabel, setScanLabel] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<OcrResult | null>(null);

  const handleOpen = useCallback(() => {
    if (editing) {
      const { id: _, ...rest } = editing;
      setForm(rest);
    } else {
      setForm(emptyForm());
    }
  }, [editing]);

  useMemo(() => {
    if (open) handleOpen();
  }, [open, handleOpen]);

  const categories = (form.type === 'income' ? settings.incomeCategories : settings.costCategories) ?? [];
  const categoryMeta = (settings.costCategoryMeta || []).find((m) => m.name === form.category);
  const showAllowabilityWarning = form.type === 'cost' && categoryMeta && categoryMeta.allowable !== 'yes';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.category) return;
    onSave(form);
  };

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 5MB limit`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const attachment: Attachment = {
          id: crypto.randomUUID(),
          name: file.name,
          data: ev.target?.result as string,
        };
        setForm((prev) => ({ ...prev, attachments: [...(prev.attachments || []), attachment] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    setForm((prev) => ({ ...prev, attachments: (prev.attachments || []).filter((a) => a.id !== id) }));
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Transaction' : 'New Transaction'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600">
          {(['income', 'cost'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { set('type', t); set('category', ''); }}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium capitalize transition-colors first:rounded-l-lg last:rounded-r-lg',
                form.type === t
                  ? t === 'income' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date</span>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount ({settings.currencySymbol})</span>
            <input type="number" step="0.01" min="0" value={form.amount || ''} onChange={(e) => {
              const amt = parseFloat(e.target.value) || 0;
              set('amount', amt);
              if (form.vatRate !== null && form.vatRate !== undefined) {
                set('vatAmount', calculateVatAmount(amt, form.vatRate));
              }
            }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
              placeholder="0.00" />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
          <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            placeholder="What was this for?" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
            <select value={form.category} onChange={(e) => {
              set('category', e.target.value);
              const meta = (settings.costCategoryMeta || []).find((m) => m.name === e.target.value);
              if (meta?.allowable === 'no') set('taxDeductible', false);
              else if (meta?.allowable === 'yes') set('taxDeductible', true);
            }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600">
              <option value="">Select...</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Client</span>
            <select value={form.clientId ?? ''} onChange={(e) => set('clientId', e.target.value || null)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600">
              <option value="">None</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        {/* Allowability warning */}
        {showAllowabilityWarning && (
          <div className={cn(
            'rounded-lg p-3 text-xs',
            categoryMeta.allowable === 'no'
              ? 'bg-orange-50 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
          )}>
            {categoryMeta.allowable === 'no' ? (
              <p>This category is <strong>not tax-deductible</strong>. It will not reduce your taxable profit.</p>
            ) : (
              <>
                <p>{categoryMeta.note || 'This category is partially allowable.'}</p>
                <label className="mt-2 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.taxDeductible} onChange={(e) => set('taxDeductible', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                  <span className="font-medium">This expense is tax-deductible</span>
                </label>
              </>
            )}
          </div>
        )}

        {/* VAT rate selector */}
        {settings.vatRegistered && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">VAT Rate</span>
              <select value={form.vatRate ?? ''} onChange={(e) => {
                const rate = e.target.value === '' ? null : parseFloat(e.target.value);
                set('vatRate', rate);
                set('vatAmount', calculateVatAmount(form.amount, rate));
              }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                <option value="">Exempt / N/A</option>
                <option value="20">20% Standard</option>
                <option value="5">5% Reduced</option>
                <option value="0">0% Zero-rated</option>
              </select>
            </label>
            <div className="flex flex-col justify-end">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Net: {formatCurrency(form.amount, settings.currencySymbol)}
                {form.vatRate !== null && form.vatRate !== undefined && ` + VAT: ${formatCurrency(form.vatAmount || 0, settings.currencySymbol)} = ${formatCurrency(form.amount + (form.vatAmount || 0), settings.currencySymbol)}`}
              </p>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</span>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            placeholder="Optional notes" />
        </label>

        {/* Attachments & Receipt Scan */}
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Receipts / Attachments</span>
          <div className="mt-1 flex items-center gap-2">
            <input type="file" accept="image/*,.pdf" multiple onChange={handleFileUpload}
              className="block w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-700 dark:file:text-slate-300" />
            <label className="shrink-0 cursor-pointer rounded-lg border border-dashed border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:border-brand-500/40 dark:text-brand-400 dark:hover:bg-brand-500/10">
              {scanLabel ? <ScanProgressBar label={scanLabel} /> : 'Scan Receipt'}
              <input type="file" accept="image/*" className="hidden" disabled={!!scanLabel} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setScanLabel('Preparing...');
                setScanResult(null);
                try {
                  const result = await recognizeReceipt(file, {
                    experimental: settings.experimentalReceiptScanning ?? false,
                    onProgress: (p) => setScanLabel(p.label),
                  });
                  setScanResult(result);
                  if (result.totalAmount && result.confidence.totalAmount > 0.3) {
                    setForm((prev) => ({ ...prev, amount: result.totalAmount! }));
                  }
                  if (result.date && result.confidence.date > 0.5) {
                    setForm((prev) => ({ ...prev, date: result.date! }));
                  }
                  if (result.vendor && result.confidence.vendor > 0.4) {
                    setForm((prev) => ({ ...prev, description: result.vendor! }));
                  }
                  if (result.vatAmount && result.confidence.vatAmount > 0.5) {
                    setForm((prev) => ({ ...prev, vatAmount: result.vatAmount!, vatRate: 20 }));
                  }
                  // Auto-attach scanned receipt image
                  const reader = new FileReader();
                  reader.onload = () => {
                    const attachment: Attachment = {
                      id: `receipt-${Date.now()}`,
                      name: file.name,
                      data: reader.result as string,
                    };
                    setForm((prev) => ({ ...prev, attachments: [...(prev.attachments || []), attachment] }));
                  };
                  reader.readAsDataURL(file);
                } catch (err) {
                  console.error('Receipt scan failed:', err);
                  alert('Receipt scan failed. Please try a clearer image.');
                } finally {
                  setScanLabel(null);
                }
              }} />
            </label>
          </div>
          {scanResult && (
            <div className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
              Scanned: {scanResult.totalAmount ? `${settings.currencySymbol}${scanResult.totalAmount.toFixed(2)}` : 'no amount'}
              {scanResult.vendor && ` from ${scanResult.vendor}`}
              {scanResult.date && ` on ${scanResult.date}`}
              {' '}<button type="button" onClick={() => setScanResult(null)} className="underline">dismiss</button>
            </div>
          )}
          {(form.attachments || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.attachments.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700">
                  <a href={a.data} download={a.name} className="text-brand-600 underline hover:text-brand-700 dark:text-brand-400">{a.name}</a>
                  <button type="button" onClick={() => removeAttachment(a.id)} className="text-red-400 hover:text-red-600">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button onClick={onClose} type="button"
            className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Cancel
          </button>
          <button type="submit" disabled={!form.description || !form.amount || !form.category}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50">
            {editing ? 'Save Changes' : 'Add Transaction'}
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

function CheckCircleIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
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
