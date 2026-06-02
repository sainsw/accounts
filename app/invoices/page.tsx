'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/Card';
import { Button, Modal } from '@/components/Modal';
import { cn, formatCurrency, formatDate, todayString, getYearRange, getFinancialYear } from '@/lib/utils';
import type { TrackedInvoice, Transaction, InvoiceWorkBlock, InvoiceExpense } from '@/lib/types';
import { downloadInvoicePdf, getInvoicePdfAttachment } from '@/lib/invoice-pdf-adapter';
import { computeInvoiceTotals, getWeekdays } from '@/lib/invoice-utils';
import dynamic from 'next/dynamic';
import { WorkBlocksEditor } from '@/components/WorkBlocksEditor';
import { ExpensesEditor } from '@/components/ExpensesEditor';

const PdfImportWizard = dynamic(() => import('@/components/PdfImportWizard'), { ssr: false });

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

let nextId = 1;
function uid() { return `tmp-${nextId++}-${Date.now()}`; }

function newWorkBlock(dailyRate: number): InvoiceWorkBlock {
  return { id: uid(), description: '', startDate: todayString(), endDate: todayString(), billingMode: 'daily', dailyRate, blockTotal: 0 };
}

function newExpense(): InvoiceExpense {
  return { id: uid(), date: todayString(), notes: '', amount: 0 };
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesContent />
    </Suspense>
  );
}

function InvoicesContent() {
  const { ready, settings, invoices, clients, transactions, addInvoice, updateInvoice, deleteInvoice, addTransaction, deleteTransactionsByInvoiceId } = useApp();
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState<TrackedInvoice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrackedInvoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | TrackedInvoice['status']>('');
  const [priorYearFilter, setPriorYearFilter] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [importData, setImportData] = useState<FormData | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const importProcessed = useRef(false);

  const locale = settings.locale || 'en-US';
  const today = todayString();
  const currentFinYear = getFinancialYear(today, settings.taxYear);
  const currentYearRange = getYearRange(currentFinYear, settings.taxYear);

  useEffect(() => {
    if (!ready || importProcessed.current) return;
    // Open a blank invoice form when arriving via the global "+ New" menu.
    if (searchParams.get('new') === '1') {
      importProcessed.current = true;
      setEditing(null);
      setModalOpen(true);
      router.replace('/invoices');
      return;
    }
    const raw = searchParams.get('import');
    if (!raw) return;
    importProcessed.current = true;
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
        notes: data.notes || '',
        workBlocks: data.workBlocks || undefined,
        expenses: data.expenses || undefined,
        taxRate: data.taxRate ?? undefined,
        purchaseOrder: data.purchaseOrder || undefined,
      };
      if (prefilled.workBlocks?.length || prefilled.expenses?.length) {
        const totals = computeInvoiceTotals(prefilled.workBlocks || [], prefilled.expenses || [], prefilled.taxRate || 0);
        prefilled.amount = totals.total;
      }
      setImportData(prefilled);
      setEditing(null);
      setModalOpen(true);
      router.replace('/invoices');
    } catch {
      // Invalid import data, ignore
    }
  }, [ready, searchParams, clients, router]);

  const filtered = useMemo(() => {
    let list = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    if (statusFilter) list = list.filter((i) => i.status === statusFilter);
    if (priorYearFilter) {
      list = list.filter((i) => {
        const issuedBefore = i.issueDate < currentYearRange.start;
        const unpaid = i.status !== 'paid';
        return issuedBefore && unpaid;
      });
    }
    return list;
  }, [invoices, statusFilter, priorYearFilter, currentYearRange]);

  const stats = useMemo(() => {
    const total = invoices.reduce((s, i) => s + i.amount, 0);
    const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
    const overdue = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
    return { total, paid, outstanding, overdue };
  }, [invoices]);

  const sym = settings.currencySymbol || '$';

  const openNew = useCallback(() => { setEditing(null); setImportData(null); setModalOpen(true); }, []);
  const openEdit = useCallback((i: TrackedInvoice) => { setEditing(i); setImportData(null); setModalOpen(true); }, []);

  const [markPaidInvoice, setMarkPaidInvoice] = useState<TrackedInvoice | null>(null);
  const [markPaidDate, setMarkPaidDate] = useState(todayString());
  const [confirmReplaceTx, setConfirmReplaceTx] = useState(false);
  const [pendingStatusSave, setPendingStatusSave] = useState<{ data: FormData; linkedTxs: Transaction[] } | null>(null);

  if (!ready) return null;

  const crossesTaxYear = (inv: TrackedInvoice) => {
    if (inv.status === 'paid') return false;
    const issueYear = getFinancialYear(inv.issueDate, settings.taxYear);
    return issueYear < currentFinYear;
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Track and manage your invoices"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowImporter((v) => !v)}>
              <UploadIcon /> Import PDFs
            </Button>
            <Button onClick={openNew}><PlusIcon /> New Invoice</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Invoiced" value={formatCurrency(stats.total, sym)} color="blue" />
        <StatCard label="Paid" value={formatCurrency(stats.paid, sym)} color="green" />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding, sym)} color="blue" />
        <StatCard label="Overdue" value={formatCurrency(stats.overdue, sym)} color="red" />
      </div>

      {showImporter && (
        <div className="mb-6">
          <PdfImportWizard
            clients={clients}
            existingInvoiceNumbers={invoices.map((i) => i.invoiceNumber)}
            onComplete={(imported) => {
              for (const inv of imported) {
                const { pdfData, ...invoiceData } = inv;
                const invoiceId = addInvoice(invoiceData);
                if (inv.status === 'paid') {
                  const attachments = pdfData
                    ? [{ id: `pdf-${invoiceId}`, name: `${inv.invoiceNumber}.pdf`, data: pdfData }]
                    : [];
                  addTransaction({
                    date: inv.paidDate || todayString(),
                    type: 'income',
                    amount: inv.amount,
                    description: `Invoice #${inv.invoiceNumber}`,
                    category: settings.incomeCategories?.[0] || 'Consulting',
                    clientId: inv.clientId || null,
                    invoiceId,
                    notes: `Imported from PDF`,
                    vatRate: null,
                    vatAmount: 0,
                    taxDeductible: true,
                    attachments,
                  });
                }
              }
              setShowImporter(false);
            }}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['', 'draft', 'sent', 'paid', 'overdue'] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPriorYearFilter(false); }}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s && !priorYearFilter
                ? 'bg-brand-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            {s ? STATUS_LABELS[s] : 'All'}
          </button>
        ))}
        <button
          onClick={() => { setPriorYearFilter(!priorYearFilter); setStatusFilter(''); }}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            priorYearFilter
              ? 'bg-amber-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
          )}
        >
          Unpaid from prior year
        </button>
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
                {filtered.map((inv) => {
                  const crossesBoundary = crossesTaxYear(inv);
                  const hasLineItems = (inv.workBlocks?.length ?? 0) > 0 || (inv.expenses?.length ?? 0) > 0;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => openEdit(inv)}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          {inv.invoiceNumber}
                          {hasLineItems && (
                            <span className="inline-flex rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                              Itemized
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.clientName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(inv.issueDate, locale)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{inv.dueDate ? formatDate(inv.dueDate, locale) : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(inv.amount, sym)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[inv.status])}>
                            {STATUS_LABELS[inv.status]}
                          </span>
                          {crossesBoundary && (
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" title="This invoice crosses a tax year boundary">
                              Crosses tax year
                            </span>
                          )}
                        </div>
                        {crossesBoundary && settings.accountingBasis === 'cash' && (
                          <p className="mt-0.5 text-[10px] text-slate-400">Cash basis: won&apos;t affect prior year tax</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {(inv.status === 'sent' || inv.status === 'overdue') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMarkPaidDate(inv.dueDate || inv.issueDate || todayString());
                                setMarkPaidInvoice(inv);
                              }}
                              className="rounded px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (transactions.some((t) => t.invoiceId === inv.id)) {
                                setConfirmDeleteInvoice(inv);
                              } else {
                                deleteInvoice(inv.id);
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

      {/* Mark as Paid modal */}
      <MarkPaidModal
        invoice={markPaidInvoice}
        transactions={transactions}
        settings={settings}
        sym={sym}
        date={markPaidDate}
        onDateChange={setMarkPaidDate}
        showReplace={confirmReplaceTx}
        onClose={() => { setMarkPaidInvoice(null); setConfirmReplaceTx(false); }}
        onConfirm={(replace) => {
          if (!markPaidInvoice) return;
          const linkedTxs = transactions.filter((t) => t.invoiceId === markPaidInvoice.id);
          if (!confirmReplaceTx && linkedTxs.length > 0) {
            setConfirmReplaceTx(true);
            return;
          }
          updateInvoice({ ...markPaidInvoice, status: 'paid', paidDate: markPaidDate });
          if (replace) {
            deleteTransactionsByInvoiceId(markPaidInvoice.id);
          }
          if (replace || linkedTxs.length === 0) {
            const parts: string[] = [];
            if (markPaidInvoice.workBlocks?.length) {
              parts.push(...markPaidInvoice.workBlocks.filter((wb) => wb.description).map((wb) =>
                `${wb.description} ${sym}${wb.blockTotal.toFixed(2)}`
              ));
            }
            if (markPaidInvoice.expenses?.length) {
              const expTotal = markPaidInvoice.expenses.reduce((s, e) => s + e.amount, 0);
              if (expTotal > 0) parts.push(`Expenses ${sym}${expTotal.toFixed(2)}`);
            }
            const client = clients.find((c) => c.id === markPaidInvoice.clientId);
            const attachment = getInvoicePdfAttachment(markPaidInvoice, settings, client);
            addTransaction({
              date: markPaidDate,
              type: 'income',
              amount: markPaidInvoice.amount,
              description: `Invoice #${markPaidInvoice.invoiceNumber}`,
              category: settings.incomeCategories?.[0] || 'Consulting',
              clientId: markPaidInvoice.clientId || null,
              invoiceId: markPaidInvoice.id,
              notes: parts.join(', '),
              vatRate: null,
              vatAmount: 0,
              taxDeductible: true,
              attachments: [attachment],
            });
          }
          setMarkPaidInvoice(null);
          setConfirmReplaceTx(false);
        }}
      />

      {/* Delete invoice confirmation */}
      <Modal open={!!confirmDeleteInvoice} onClose={() => setConfirmDeleteInvoice(null)} title="Delete Invoice">
        {confirmDeleteInvoice && (() => {
          const hasLinkedTx = transactions.some((t) => t.invoiceId === confirmDeleteInvoice.id);
          return (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Delete invoice <span className="font-medium text-slate-900 dark:text-slate-100">#{confirmDeleteInvoice.invoiceNumber}</span> ({formatCurrency(confirmDeleteInvoice.amount, sym)})?
              </p>
              {hasLinkedTx && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  This invoice has a linked income transaction. Would you also like to remove it?
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button onClick={() => setConfirmDeleteInvoice(null)} type="button"
                  className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                  Cancel
                </button>
                {hasLinkedTx && (
                  <button
                    onClick={() => {
                      deleteInvoice(confirmDeleteInvoice.id);
                      setConfirmDeleteInvoice(null);
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Delete Invoice Only
                  </button>
                )}
                <button
                  onClick={() => {
                    if (hasLinkedTx) deleteTransactionsByInvoiceId(confirmDeleteInvoice.id);
                    deleteInvoice(confirmDeleteInvoice.id);
                    setConfirmDeleteInvoice(null);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
                >
                  {hasLinkedTx ? 'Delete Both' : 'Delete Invoice'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Confirm delete linked transactions on status change */}
      <Modal open={!!pendingStatusSave} onClose={() => setPendingStatusSave(null)} title="Delete Linked Transactions?">
        {pendingStatusSave && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Changing status from <span className="font-medium text-slate-900 dark:text-slate-100">Paid</span> will leave these linked transactions:
            </p>
            <ul className="space-y-1.5">
              {pendingStatusSave.linkedTxs.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-700/50">
                  <span className="text-slate-700 dark:text-slate-300">{tx.description}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(tx.amount, sym)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button onClick={() => setPendingStatusSave(null)} type="button"
                className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editing) updateInvoice({ ...pendingStatusSave.data, id: editing.id });
                  setPendingStatusSave(null);
                  setModalOpen(false);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Keep Transactions
              </button>
              <button
                onClick={() => {
                  if (editing) {
                    updateInvoice({ ...pendingStatusSave.data, id: editing.id });
                    deleteTransactionsByInvoiceId(editing.id);
                  }
                  setPendingStatusSave(null);
                  setModalOpen(false);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
              >
                Delete Transactions
              </button>
            </div>
          </div>
        )}
      </Modal>

      <InvoiceModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setImportData(null); }}
        editing={editing}
        importData={importData}
        clients={clients}
        sym={sym}
        settings={settings}
        onSave={(data) => {
          setImportData(null);
          if (editing) {
            const linkedTxs = transactions.filter((t) => t.invoiceId === editing.id);
            if (editing.status === 'paid' && data.status !== 'paid' && linkedTxs.length > 0) {
              setPendingStatusSave({ data, linkedTxs });
              setModalOpen(false);
              return;
            }
            updateInvoice({ ...data, id: editing.id });
            if (data.status === 'paid' && editing.status !== 'paid' && linkedTxs.length === 0) {
              const parts: string[] = [];
              const inv = { ...data, id: editing.id } as TrackedInvoice;
              if (inv.workBlocks?.length) {
                parts.push(...inv.workBlocks.filter((wb) => wb.description).map((wb) =>
                  `${wb.description} ${sym}${wb.blockTotal.toFixed(2)}`
                ));
              }
              if (inv.expenses?.length) {
                const expTotal = inv.expenses.reduce((s, e) => s + e.amount, 0);
                if (expTotal > 0) parts.push(`Expenses ${sym}${expTotal.toFixed(2)}`);
              }
              const client = clients.find((c) => c.id === data.clientId);
              const attachment = getInvoicePdfAttachment(inv, settings, client);
              addTransaction({
                date: data.paidDate || todayString(),
                type: 'income',
                amount: data.amount,
                description: `Invoice #${data.invoiceNumber}`,
                category: settings.incomeCategories?.[0] || 'Consulting',
                clientId: data.clientId || null,
                invoiceId: editing.id,
                notes: parts.join(', '),
                vatRate: null,
                vatAmount: 0,
                taxDeductible: true,
                attachments: [attachment],
              });
            }
          } else {
            addInvoice(data);
          }
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
  settings,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: TrackedInvoice | null;
  importData: FormData | null;
  clients: import('@/lib/types').Client[];
  sym: string;
  settings: import('@/lib/types').Settings;
  onSave: (data: FormData) => void;
}) {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [itemized, setItemized] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useMemo(() => {
    if (open) {
      if (importData) {
        setForm(importData);
        setItemized(!!(importData.workBlocks?.length || importData.expenses?.length));
      } else if (editing) {
        const { id: _, ...rest } = editing;
        if (rest.workBlocks?.length) {
          rest.workBlocks = rest.workBlocks.map((wb) => {
            const days = getWeekdays(wb.startDate, wb.endDate);
            if (wb.billingMode === 'daily' && wb.dailyRate > 0) {
              return { ...wb, blockTotal: Math.round(wb.dailyRate * days * 100) / 100 };
            }
            if (wb.billingMode === 'block' && wb.blockTotal > 0 && days > 0) {
              return { ...wb, dailyRate: Math.round(wb.blockTotal / days * 10000) / 10000 };
            }
            return wb;
          });
        }
        setForm(rest);
        setItemized(!!(rest.workBlocks?.length || rest.expenses?.length));
      } else {
        setForm(emptyForm());
        setItemized(false);
      }
    }
  }, [open, editing, importData]);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const workBlocks = form.workBlocks || [];
  const expenses = form.expenses || [];
  const taxRate = form.taxRate || 0;

  const totals = useMemo(
    () => itemized ? computeInvoiceTotals(workBlocks, expenses, taxRate) : null,
    [itemized, workBlocks, expenses, taxRate]
  );

  const setWorkBlock = (id: string, patch: Partial<InvoiceWorkBlock>) => {
    set('workBlocks', workBlocks.map((wb) => {
      if (wb.id !== id) return wb;
      const merged = { ...wb, ...patch };
      const days = getWeekdays(merged.startDate, merged.endDate);
      const isDailyEdit = 'dailyRate' in patch && !('blockTotal' in patch);
      const isBlockEdit = 'blockTotal' in patch && !('dailyRate' in patch);
      const isDateEdit = 'startDate' in patch || 'endDate' in patch;
      if (isDailyEdit) {
        const rate = Math.max(0, merged.dailyRate);
        return { ...merged, dailyRate: rate, billingMode: 'daily' as const, blockTotal: Math.round(rate * days * 100) / 100 };
      }
      if (isBlockEdit) {
        const total = Math.max(0, merged.blockTotal);
        return { ...merged, blockTotal: total, billingMode: 'block' as const, dailyRate: days > 0 ? Math.round(total / days * 10000) / 10000 : 0 };
      }
      if (isDateEdit) {
        const rate = Math.max(0, merged.dailyRate);
        return { ...merged, dailyRate: rate, blockTotal: Math.round(rate * days * 100) / 100 };
      }
      return merged;
    }));
  };

  const setExpense = (id: string, patch: Partial<InvoiceExpense>) => {
    set('expenses', expenses.map((ex) => ex.id === id ? { ...ex, ...patch } : ex));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalForm = { ...form };
    if (itemized && totals) {
      finalForm.amount = totals.total;
    }
    if (!finalForm.invoiceNumber || !finalForm.clientName || !finalForm.amount) return;
    if (!itemized) {
      delete finalForm.workBlocks;
      delete finalForm.expenses;
      delete finalForm.taxRate;
      delete finalForm.purchaseOrder;
    }
    onSave(finalForm);
  };

  const defaultRate = settings.invoicing?.defaultDailyRate || 0;

  const inputCls = "mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600";

  return (
    <Modal open={open} onClose={onClose} title={importData ? 'Import from Invoicer' : editing ? 'Edit Invoice' : 'Track Invoice'} wide={itemized}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Invoice # *</span>
            <input type="text" value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)}
              className={inputCls} placeholder="INV-001" />
          </label>
          {!itemized ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount ({sym}) *</span>
              <input type="number" step="0.01" min="0" value={form.amount || ''} onChange={(e) => set('amount', parseFloat(e.target.value) || 0)}
                className={inputCls} />
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">PO Number</span>
              <input type="text" value={form.purchaseOrder || ''} onChange={(e) => set('purchaseOrder', e.target.value)}
                className={inputCls} placeholder="Optional" />
            </label>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Client *</span>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <select
              value={form.clientId ?? ''}
              onChange={(e) => {
                const c = clients.find((cl) => cl.id === e.target.value);
                set('clientId', c?.id ?? null);
                if (c) set('clientName', c.name);
              }}
              className={"flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"}
            >
              <option value="">Select or type name</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="text" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Client name"
              className={"flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"} />
          </div>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Issue Date</span>
            <input type="date" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Due Date</span>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inputCls} />
          </label>
        </div>

        {/* Itemized toggle */}
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={itemized}
              onChange={(e) => {
                const on = e.target.checked;
                setItemized(on);
                if (on && !workBlocks.length) {
                  set('workBlocks', [newWorkBlock(defaultRate)]);
                }
              }}
              className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Itemized invoice</span>
          </label>
          <span className="text-xs text-slate-400">Add work blocks &amp; expenses</span>
        </div>

        {itemized && (
          <div className="space-y-6">
            {/* Work Blocks */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Work blocks</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Weekdays only — weekends are skipped automatically.</p>
                </div>
                <button type="button" onClick={() => set('workBlocks', [...workBlocks, newWorkBlock(defaultRate)])}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                  + Add block
                </button>
              </div>
              {workBlocks.length === 0 ? (
                <p className="text-sm text-slate-400">No work blocks yet.</p>
              ) : (
                <WorkBlocksEditor
                  blocks={workBlocks}
                  currencySymbol={sym}
                  inputCls={inputCls}
                  onChange={setWorkBlock}
                  onRemove={(id) => set('workBlocks', workBlocks.filter((w) => w.id !== id))}
                  onDuplicate={(id) => {
                    const wb = workBlocks.find((w) => w.id === id);
                    if (wb) set('workBlocks', [...workBlocks, { ...wb, id: uid() }]);
                  }}
                  onReorder={(ids) => {
                    const map = new Map(workBlocks.map((w) => [w.id, w]));
                    set('workBlocks', ids.map((id) => map.get(id)!));
                  }}
                />
              )}
            </div>

            {/* Expenses */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Expenses</h3>
                <button type="button" onClick={() => set('expenses', [...expenses, newExpense()])}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                  + Add expense
                </button>
              </div>
              {expenses.length === 0 ? (
                <p className="text-sm text-slate-400">No expenses yet.</p>
              ) : (
                <ExpensesEditor
                  expenses={expenses}
                  currencySymbol={sym}
                  inputCls={inputCls}
                  onChange={setExpense}
                  onRemove={(id) => set('expenses', expenses.filter((e2) => e2.id !== id))}
                  onDuplicate={(id) => {
                    const ex = expenses.find((e) => e.id === id);
                    if (ex) set('expenses', [...expenses, { ...ex, id: uid() }]);
                  }}
                  onReorder={(ids) => {
                    const map = new Map(expenses.map((e) => [e.id, e]));
                    set('expenses', ids.map((id) => map.get(id)!));
                  }}
                />
              )}
            </div>

            {/* Tax */}
            <div className="flex items-center gap-3">
              <label className="block w-32">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tax Rate (%)</span>
                <input type="number" step="0.01" min="0" max="100" value={taxRate || ''} onChange={(e) => set('taxRate', parseFloat(e.target.value) || 0)}
                  className={inputCls} />
              </label>
            </div>

            {/* Totals */}
            {totals && (
              <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="space-y-1 text-right text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Work subtotal</span>
                    <span>{formatCurrency(totals.workSubtotal, sym)}</span>
                  </div>
                  {totals.expensesSubtotal > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Expenses subtotal</span>
                      <span>{formatCurrency(totals.expensesSubtotal, sym)}</span>
                    </div>
                  )}
                  {totals.taxAmount > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Tax ({taxRate}%)</span>
                      <span>{formatCurrency(totals.taxAmount, sym)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">
                    <span>Total</span>
                    <span>{formatCurrency(totals.total, sym)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value as TrackedInvoice['status'])}
            className={inputCls}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>

        {form.status === 'paid' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Paid Date</span>
            <input type="date" value={form.paidDate ?? ''} onChange={(e) => set('paidDate', e.target.value || null)} className={inputCls} />
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</span>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={inputCls} />
        </label>

        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
          <div>
            {editing && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const finalForm = { ...form };
                    if (itemized && totals) finalForm.amount = totals.total;
                    const client = clients.find((c) => c.id === editing.clientId);
                    try {
                      const attachment = getInvoicePdfAttachment({ ...finalForm, id: editing.id } as TrackedInvoice, settings, client);
                      setPreviewUri(attachment.data);
                    } catch {
                      alert('Failed to generate preview.');
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const finalForm = { ...form };
                    if (itemized && totals) finalForm.amount = totals.total;
                    onSave(finalForm);
                    const client = clients.find((c) => c.id === editing.clientId);
                    downloadInvoicePdf({ ...finalForm, id: editing.id } as TrackedInvoice, settings, client);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <DownloadIcon /> Download PDF
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} type="button"
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={!form.invoiceNumber || !form.clientName || (!itemized && !form.amount) || (itemized && !!totals && !totals.total)}
              className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50">
              {editing ? 'Save Changes' : 'Track Invoice'}
            </button>
          </div>
        </div>
      </form>
      {previewUri && (
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Invoice Preview</h3>
            <button type="button" onClick={() => setPreviewUri(null)} className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400">Close preview</button>
          </div>
          <iframe src={previewUri} title="Invoice preview" className="h-[500px] w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700" />
        </div>
      )}
    </Modal>
  );
}

function MarkPaidModal({
  invoice, transactions, settings, sym, date, onDateChange, showReplace, onClose, onConfirm,
}: {
  invoice: TrackedInvoice | null;
  transactions: import('@/lib/types').Transaction[];
  settings: import('@/lib/types').Settings;
  sym: string;
  date: string;
  onDateChange: (d: string) => void;
  showReplace: boolean;
  onClose: () => void;
  onConfirm: (replace: boolean) => void;
}) {
  const linkedTxs = invoice ? transactions.filter((t) => t.invoiceId === invoice.id) : [];

  return (
    <Modal open={!!invoice} onClose={onClose} title="Mark as Paid">
      {showReplace ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This invoice has {linkedTxs.length} linked transaction{linkedTxs.length > 1 ? 's' : ''}:
          </p>
          <div className="space-y-1">
            {linkedTxs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-700/50">
                <span className="text-slate-700 dark:text-slate-300">{tx.description || 'No description'}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(tx.amount, sym)}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Replace with a new transaction from the invoice, or keep existing?
          </p>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button onClick={onClose} type="button"
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              Cancel
            </button>
            <button onClick={() => onConfirm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
              Keep existing
            </button>
            <button onClick={() => onConfirm(true)}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600">
              Replace
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Invoice <span className="font-medium text-slate-900 dark:text-slate-100">#{invoice?.invoiceNumber}</span> — {formatCurrency(invoice?.amount ?? 0, sym)}
          </p>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Paid Date</span>
            <span className="ml-1 text-xs text-slate-400">(used for tax year)</span>
            <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
          </label>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button onClick={onClose} type="button"
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(false)}
              disabled={!date}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              Confirm Paid
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function UploadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
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

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
