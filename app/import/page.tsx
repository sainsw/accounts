'use client';

import { useState, useRef } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader } from '@/components/Card';
import { formatCurrency } from '@/lib/utils';
import { parseBankStatement, autoMatchEntries, applyCategorisationRules, BANK_PRESETS, type ParsedBankEntry, getColumnHeaders } from '@/lib/bank-import';
import { importFromCSV, getCSVHeaders, getCSVPreview, COMPETITOR_PRESETS, type ImportResult } from '@/lib/competitor-import';
import { detectFormat, parseOFX, parseQIF, type ParsedBankEntry as OFXEntry } from '@/lib/ofx-import';
import type { BankStatementFormat } from '@/lib/types';

type ImportTab = 'bank' | 'competitor';

export default function ImportPage() {
  const { settings, transactions, categorisationRules, addTransaction } = useApp();
  const [tab, setTab] = useState<ImportTab>('bank');
  const [bankEntries, setBankEntries] = useState<ParsedBankEntry[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('monzo');
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [competitorPreset, setCompetitorPreset] = useState<string>('generic');
  const [competitorCsv, setCompetitorCsv] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [step, setStep] = useState<'upload' | 'map' | 'review'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);
  const competitorFileRef = useRef<HTMLInputElement>(null);

  const sym = settings.currencySymbol || '£';

  function handleBankFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCsvText(text);

      const fileFormat = detectFormat(text);
      let entries: ParsedBankEntry[];

      if (fileFormat === 'ofx') {
        const ofxEntries = parseOFX(text);
        entries = ofxEntries.map((e, i) => ({
          id: `ofx-${i}-${Date.now()}`,
          date: e.date,
          description: e.description,
          amount: Math.abs(e.amount),
          type: (e.amount >= 0 ? 'income' : 'cost') as 'income' | 'cost',
          balance: e.balance ?? null,
          status: 'pending' as const,
          matchedTransactionId: null,
          matchConfidence: 0,
          suggestedCategory: null,
        }));
      } else if (fileFormat === 'qif') {
        const qifEntries = parseQIF(text);
        entries = qifEntries.map((e, i) => ({
          id: `qif-${i}-${Date.now()}`,
          date: e.date,
          description: e.description,
          amount: Math.abs(e.amount),
          type: (e.amount >= 0 ? 'income' : 'cost') as 'income' | 'cost',
          balance: e.balance ?? null,
          status: 'pending' as const,
          matchedTransactionId: null,
          matchConfidence: 0,
          suggestedCategory: null,
        }));
      } else {
        const format = BANK_PRESETS[selectedPreset];
        entries = parseBankStatement(text, format);
      }

      entries = autoMatchEntries(entries, transactions);
      entries = applyCategorisationRules(entries, categorisationRules);
      setBankEntries(entries);
    };
    reader.readAsText(file);
  }

  function handleCompetitorFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCompetitorCsv(text);
      const h = getCSVHeaders(text);
      setHeaders(h);

      const preset = COMPETITOR_PRESETS[competitorPreset];
      const mapping: Record<string, number> = {};
      for (const [key, colName] of Object.entries(preset.columns)) {
        const idx = h.findIndex((header) => header.toLowerCase() === colName.toLowerCase());
        mapping[key] = idx >= 0 ? idx : -1;
      }
      setColumnMapping(mapping);
      setStep('map');
    };
    reader.readAsText(file);
  }

  function handleBankImport(entry: ParsedBankEntry) {
    addTransaction({
      date: entry.date,
      type: entry.type,
      amount: entry.amount,
      description: entry.description,
      category: entry.suggestedCategory || (entry.type === 'income' ? 'Other Income' : 'Other Cost'),
      clientId: null,
      invoiceId: null,
      projectId: null,
      notes: '',
      vatRate: null,
      vatAmount: 0,
      taxDeductible: entry.type === 'cost',
      attachments: [],
      currency: null,
      exchangeRate: null,
      originalAmount: null,
      recurrence: null,
      reconciliationStatus: 'reconciled',
      importedFrom: 'bank-statement',
    });
    setBankEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: 'created' } : e));
  }

  function handleConfirmMatch(entry: ParsedBankEntry) {
    setBankEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: 'matched' } : e));
  }

  function handleSkipEntry(entry: ParsedBankEntry) {
    setBankEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: 'skipped' } : e));
  }

  function handleCompetitorImport() {
    const preset = COMPETITOR_PRESETS[competitorPreset];
    const result = importFromCSV(competitorCsv, columnMapping, preset.dateFormat, transactions);
    setImportResult(result);
    setStep('review');
  }

  function handleConfirmCompetitorImport() {
    if (!importResult) return;
    for (const t of importResult.transactions) {
      addTransaction(t);
    }
    setStep('upload');
    setCompetitorCsv('');
    setImportResult(null);
  }

  const summary = {
    total: bankEntries.length,
    matched: bankEntries.filter((e) => e.status === 'matched').length,
    created: bankEntries.filter((e) => e.status === 'created').length,
    pending: bankEntries.filter((e) => e.status === 'pending').length,
    skipped: bankEntries.filter((e) => e.status === 'skipped').length,
  };

  return (
    <>
      <PageHeader title="Import Data" description="Import bank statements or data from other accounting software" />

      <div className="mb-4 flex rounded-lg border border-slate-200 dark:border-slate-700 w-fit">
        <button onClick={() => setTab('bank')} className={`px-4 py-2 text-sm font-medium rounded-l-lg ${tab === 'bank' ? 'bg-brand-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}>
          Bank Statement
        </button>
        <button onClick={() => setTab('competitor')} className={`px-4 py-2 text-sm font-medium rounded-r-lg ${tab === 'competitor' ? 'bg-brand-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}>
          Other Software
        </button>
      </div>

      {tab === 'bank' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Bank Format</label>
                <select value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {Object.entries(BANK_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key}>{preset.name}</option>
                  ))}
                  <option value="custom">Custom mapping...</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Statement File (CSV, OFX, QIF)</label>
                <input ref={fileRef} type="file" accept=".csv,.ofx,.qif" onChange={handleBankFile} className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-600 hover:file:bg-brand-100 dark:text-slate-400" />
              </div>
            </div>
          </Card>

          {bankEntries.length > 0 && (
            <>
              <div className="grid grid-cols-5 gap-3 text-center text-xs">
                <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800"><span className="font-bold text-slate-900 dark:text-white">{summary.total}</span><br/>Total</div>
                <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-500/10"><span className="font-bold text-blue-600">{summary.matched}</span><br/>Matched</div>
                <div className="rounded-lg bg-green-50 p-2 dark:bg-green-500/10"><span className="font-bold text-green-600">{summary.created}</span><br/>Created</div>
                <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-500/10"><span className="font-bold text-amber-600">{summary.pending}</span><br/>Pending</div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-700"><span className="font-bold text-slate-500">{summary.skipped}</span><br/>Skipped</div>
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Description</th>
                        <th className="pb-2 font-medium text-right">Amount</th>
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {bankEntries.map((entry) => (
                        <tr key={entry.id} className={`${entry.status !== 'pending' ? 'opacity-50' : ''}`}>
                          <td className="py-2 text-slate-700 dark:text-slate-300">{entry.date}</td>
                          <td className="py-2 text-slate-900 dark:text-slate-100 max-w-[200px] truncate">{entry.description}</td>
                          <td className={`py-2 text-right font-medium ${entry.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount, sym)}
                          </td>
                          <td className="py-2 text-slate-600 dark:text-slate-400">{entry.suggestedCategory || '—'}</td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              entry.status === 'matched' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                              entry.status === 'created' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' :
                              entry.status === 'skipped' ? 'bg-slate-100 text-slate-500' :
                              'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            }`}>{entry.status}</span>
                          </td>
                          <td className="py-2 text-right">
                            {entry.status === 'pending' && (
                              <div className="flex justify-end gap-1">
                                <button onClick={() => handleBankImport(entry)} className="rounded px-2 py-1 text-xs font-medium text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10">
                                  Create
                                </button>
                                {entry.matchedTransactionId && (
                                  <button onClick={() => handleConfirmMatch(entry)} className="rounded px-2 py-1 text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                                    Confirm
                                  </button>
                                )}
                                <button onClick={() => handleSkipEntry(entry)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                                  Skip
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'competitor' && (
        <div className="space-y-4">
          {step === 'upload' && (
            <Card>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Import From</label>
                  <select value={competitorPreset} onChange={(e) => setCompetitorPreset(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    {Object.entries(COMPETITOR_PRESETS).map(([key, preset]) => (
                      <option key={key} value={key}>{preset.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">CSV File</label>
                  <input ref={competitorFileRef} type="file" accept=".csv" onChange={handleCompetitorFile} className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-600 hover:file:bg-brand-100 dark:text-slate-400" />
                </div>
              </div>
            </Card>
          )}

          {step === 'map' && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Map Columns</h3>
              <p className="mb-4 text-xs text-slate-500">Match your CSV columns to the required fields.</p>
              <div className="space-y-3">
                {['date', 'description', 'amount', 'category'].map((field) => (
                  <div key={field} className="flex items-center gap-4">
                    <span className="w-28 text-sm font-medium capitalize text-slate-700 dark:text-slate-300">{field}</span>
                    <select
                      value={columnMapping[field] ?? -1}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field]: parseInt(e.target.value) })}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value={-1}>— Skip —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={() => setStep('upload')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:text-slate-300">
                  Back
                </button>
                <button onClick={handleCompetitorImport} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                  Preview Import
                </button>
              </div>
            </Card>
          )}

          {step === 'review' && importResult && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Import Preview</h3>
              <div className="mb-4 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-lg bg-green-50 p-2 dark:bg-green-500/10"><span className="font-bold text-green-600">{importResult.transactions.length}</span><br/>To Import</div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-700"><span className="font-bold text-slate-500">{importResult.skipped}</span><br/>Duplicates Skipped</div>
                <div className="rounded-lg bg-red-50 p-2 dark:bg-red-500/10"><span className="font-bold text-red-600">{importResult.errors.length}</span><br/>Errors</div>
              </div>
              {importResult.transactions.length > 0 && (
                <div className="mb-4 max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pb-1">Date</th>
                        <th className="pb-1">Description</th>
                        <th className="pb-1 text-right">Amount</th>
                        <th className="pb-1">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {importResult.transactions.slice(0, 20).map((t, i) => (
                        <tr key={i}>
                          <td className="py-1">{t.date}</td>
                          <td className="py-1 max-w-[150px] truncate">{t.description}</td>
                          <td className="py-1 text-right">{formatCurrency(t.amount, sym)}</td>
                          <td className="py-1 capitalize">{t.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importResult.transactions.length > 20 && (
                    <p className="mt-2 text-xs text-slate-500">...and {importResult.transactions.length - 20} more</p>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep('map')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:text-slate-300">
                  Back
                </button>
                <button onClick={handleConfirmCompetitorImport} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                  Import {importResult.transactions.length} Transactions
                </button>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
