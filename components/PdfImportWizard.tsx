'use client';

import { useCallback, useRef, useState } from 'react';
import { Button, Modal } from '@/components/Modal';
import { cn, todayString } from '@/lib/utils';
import { parseInvoicePdfs, type ParsedInvoice } from '@/lib/pdf-import';
import type { TrackedInvoice } from '@/lib/types';

type ImportedInvoice = Omit<TrackedInvoice, 'id'>;

type Props = {
  clients: { id: string; name: string }[];
  existingInvoiceNumbers: string[];
  onComplete: (invoices: ImportedInvoice[]) => void;
};

type Step = 'drop' | 'parsing' | 'review';

export default function PdfImportWizard({ clients, existingInvoiceNumbers, onComplete }: Props) {
  const [step, setStep] = useState<Step>('drop');
  const [parsed, setParsed] = useState<ParsedInvoice[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [forms, setForms] = useState<ImportedInvoice[]>([]);
  const [confirmed, setConfirmed] = useState<ImportedInvoice[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) return;

    setStep('parsing');
    const results = await parseInvoicePdfs(pdfs);
    setParsed(results);

    // Build initial forms from parsed data
    const initialForms: ImportedInvoice[] = results.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      clientId: clients.find((c) => c.name.toLowerCase() === r.clientName.toLowerCase())?.id ?? null,
      clientName: r.clientName,
      issueDate: r.issueDate || todayString(),
      dueDate: '',
      amount: r.amount,
      status: 'paid' as const,
      paidDate: r.issueDate || todayString(),
      notes: `Imported from ${r.fileName}`,
    }));

    setForms(initialForms);
    setCurrentIndex(0);
    setConfirmed([]);
    setStep('review');
  }, [clients]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    handleFiles(files);
  }, [handleFiles]);

  const updateForm = <K extends keyof ImportedInvoice>(key: K, val: ImportedInvoice[K]) => {
    setForms((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], [key]: val };
      return next;
    });
  };

  const confirmCurrent = useCallback(() => {
    const form = forms[currentIndex];
    setConfirmed((prev) => [...prev, form]);

    if (currentIndex < forms.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // All done — show summary
      setSummaryOpen(true);
    }
  }, [forms, currentIndex]);

  const skipCurrent = useCallback(() => {
    if (currentIndex < forms.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setSummaryOpen(true);
    }
  }, [currentIndex, forms.length]);

  const finishImport = useCallback(() => {
    onComplete(confirmed);
    setSummaryOpen(false);
    setStep('drop');
    setParsed([]);
    setForms([]);
    setConfirmed([]);
    setCurrentIndex(0);
  }, [confirmed, onComplete]);

  const resetWizard = useCallback(() => {
    setStep('drop');
    setParsed([]);
    setForms([]);
    setConfirmed([]);
    setCurrentIndex(0);
    setSummaryOpen(false);
  }, []);

  // Drop zone
  if (step === 'drop') {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors cursor-pointer',
          dragOver
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
            : 'border-slate-300 hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        <UploadIcon className="mb-3 h-10 w-10 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Drop invoice PDFs here
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          or click to browse — we&apos;ll extract the details for you to review
        </p>
      </div>
    );
  }

  // Parsing state
  if (step === 'parsing') {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-600">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Reading PDFs...</p>
      </div>
    );
  }

  // Review step
  const form = forms[currentIndex];
  const parsedInfo = parsed[currentIndex];
  const isDuplicate = existingInvoiceNumbers.includes(form?.invoiceNumber);

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80">
        {/* Progress bar */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Invoice {currentIndex + 1} of {forms.length}
          </h3>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-32 rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-1.5 rounded-full bg-brand-500 transition-all"
                style={{ width: `${((currentIndex + 1) / forms.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{confirmed.length} confirmed</span>
          </div>
        </div>

        {/* Source info */}
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-700/50">
          <PdfIcon className="h-4 w-4 text-red-500" />
          <span className="truncate text-slate-600 dark:text-slate-400">{parsedInfo?.fileName}</span>
          <span className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium',
            parsedInfo?.confidence === 'high' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
            parsedInfo?.confidence === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
            'bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
          )}>
            {parsedInfo?.confidence} confidence
          </span>
        </div>

        {isDuplicate && (
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            ⚠ Invoice #{form.invoiceNumber} already exists. It will be skipped unless you change the number.
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Invoice #</span>
              <input type="text" value={form.invoiceNumber} onChange={(e) => updateForm('invoiceNumber', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Amount</span>
              <input type="number" step="0.01" min="0" value={form.amount || ''} onChange={(e) => updateForm('amount', parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Client</span>
            <div className="mt-1 flex gap-2">
              <select
                value={form.clientId ?? ''}
                onChange={(e) => {
                  const c = clients.find((cl) => cl.id === e.target.value);
                  updateForm('clientId', c?.id ?? null);
                  if (c) updateForm('clientName', c.name);
                }}
                className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"
              >
                <option value="">Select or type name</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" value={form.clientName} onChange={(e) => updateForm('clientName', e.target.value)} placeholder="Client name"
                className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Issue Date</span>
              <input type="date" value={form.issueDate} onChange={(e) => updateForm('issueDate', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Status</span>
              <select value={form.status} onChange={(e) => updateForm('status', e.target.value as TrackedInvoice['status'])}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
          <Button variant="ghost" size="sm" onClick={resetWizard}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={skipCurrent}>Skip</Button>
            <Button size="sm" onClick={confirmCurrent} disabled={!form.invoiceNumber || !form.amount || isDuplicate}>
              {currentIndex < forms.length - 1 ? 'Confirm & Next' : 'Confirm & Finish'}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary modal */}
      <Modal open={summaryOpen} onClose={() => setSummaryOpen(false)} title="Import Summary">
        <div className="space-y-3">
          {confirmed.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices were confirmed for import.</p>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {confirmed.length} invoice{confirmed.length !== 1 ? 's' : ''} ready to import:
              </p>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {confirmed.map((inv, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-700/50">
                    <div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{inv.invoiceNumber}</span>
                      <span className="ml-2 text-xs text-slate-500">{inv.clientName}</span>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{inv.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSummaryOpen(false)}>Back</Button>
            {confirmed.length > 0 && (
              <Button onClick={finishImport}>
                Import {confirmed.length} Invoice{confirmed.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}
