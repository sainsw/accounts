'use client';

import { useCallback, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader } from '@/components/Card';
import { Button } from '@/components/Modal';
import type { Settings, InvoicingSettings, ExtraReference } from '@/lib/types';
import { DEFAULT_COST_CATEGORIES, DEFAULT_INCOME_CATEGORIES, UK_COST_CATEGORIES, DEFAULT_COST_CATEGORY_META, defaultInvoicingSettings } from '@/lib/defaults';
import { exportTransactionsCSV, exportInvoicesCSV, downloadCsv } from '@/lib/export';
import { todayString } from '@/lib/utils';

export default function SettingsPage() {
  const { ready, settings, updateSettings } = useApp();
  const [newIncomeCat, setNewIncomeCat] = useState('');
  const [newCostCat, setNewCostCat] = useState('');
  const [saved, setSaved] = useState(false);

  const set = useCallback(
    <K extends keyof Settings>(key: K, val: Settings[K]) => {
      updateSettings({ ...settings, [key]: val });
    },
    [settings, updateSettings]
  );

  const flash = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const addCategory = useCallback(
    (type: 'income' | 'cost') => {
      const val = type === 'income' ? newIncomeCat.trim() : newCostCat.trim();
      if (!val) return;
      const key = type === 'income' ? 'incomeCategories' : 'costCategories';
      const existing = settings[key];
      if (existing.includes(val)) return;
      set(key, [...existing, val]);
      if (type === 'income') setNewIncomeCat('');
      else setNewCostCat('');
    },
    [settings, set, newIncomeCat, newCostCat]
  );

  const removeCategory = useCallback(
    (type: 'income' | 'cost', cat: string) => {
      const key = type === 'income' ? 'incomeCategories' : 'costCategories';
      set(key, settings[key].filter((c) => c !== cat));
    },
    [settings, set]
  );

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure your accounting preferences"
        actions={
          saved ? (
            <span className="text-sm font-medium text-emerald-600">Saved automatically</span>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* Business Info */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Business Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Business Name</span>
              <input type="text" value={settings.businessName} onChange={(e) => { set('businessName', e.target.value); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
              <input type="email" value={settings.email} onChange={(e) => { set('email', e.target.value); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</span>
              <input type="tel" value={settings.phone} onChange={(e) => { set('phone', e.target.value); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Currency Symbol</span>
              <input type="text" value={settings.currencySymbol} onChange={(e) => { set('currencySymbol', e.target.value); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" maxLength={5} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Business Address</span>
              <textarea value={settings.businessAddress} onChange={(e) => { set('businessAddress', e.target.value); flash(); }} rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
            </label>
          </div>
        </Card>

        {/* Tax Settings */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Tax Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Financial Year</span>
              <select value={settings.taxYear} onChange={(e) => { set('taxYear', e.target.value as Settings['taxYear']); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                <option value="calendar">Calendar Year (Jan - Dec)</option>
                <option value="apr-mar">Apr - Mar (UK/India)</option>
                <option value="jul-jun">Jul - Jun (Australia)</option>
                <option value="oct-sep">Oct - Sep (US Federal)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tax Calculation</span>
              <select value={settings.taxMode} onChange={(e) => { set('taxMode', e.target.value as Settings['taxMode']); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                <option value="flat">Flat Rate</option>
                <option value="uk-sole-trader">UK Sole Trader (Income Tax + NI)</option>
              </select>
            </label>
            {settings.taxMode === 'flat' && (
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Estimated Tax Rate (%)</span>
                <input type="number" min="0" max="100" step="0.5" value={settings.taxRate} onChange={(e) => { set('taxRate', parseFloat(e.target.value) || 0); flash(); }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
              </label>
            )}
            {settings.taxMode === 'uk-sole-trader' && (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Accounting Basis</span>
                  <select value={settings.accountingBasis} onChange={(e) => { set('accountingBasis', e.target.value as Settings['accountingBasis']); flash(); }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                    <option value="cash">Cash Basis</option>
                    <option value="accruals">Accruals</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-400">
                    {settings.accountingBasis === 'cash'
                      ? 'Report income when you receive payment and expenses when you pay them.'
                      : 'Report income when you invoice and expenses when you receive the bill.'}
                  </p>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Student Loan Plan</span>
                  <select value={settings.studentLoanPlan} onChange={(e) => { set('studentLoanPlan', e.target.value as Settings['studentLoanPlan']); flash(); }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                    <option value="none">None</option>
                    <option value="plan1">Plan 1 (9% above £22,015)</option>
                    <option value="plan2">Plan 2 (9% above £27,295)</option>
                    <option value="plan4">Plan 4 — Scotland (9% above £27,660)</option>
                    <option value="plan5">Plan 5 (9% above £25,000)</option>
                    <option value="postgrad">Postgraduate (6% above £21,000)</option>
                  </select>
                </label>
                <div className="sm:col-span-2 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={settings.voluntaryClass2NI} onChange={(e) => { set('voluntaryClass2NI', e.target.checked); flash(); }}
                      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">I voluntarily pay Class 2 NI</span>
                  </label>
                  <span className="text-xs text-slate-400">(for state pension entitlement — not required from 2024/25)</span>
                </div>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Locale</span>
                  <select value={settings.locale} onChange={(e) => { set('locale', e.target.value); flash(); }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                    <option value="en-GB">English (UK) — 5 Mar 2025</option>
                    <option value="en-US">English (US) — Mar 5, 2025</option>
                  </select>
                </label>
              </>
            )}
          </div>
        </Card>

        {/* VAT Settings */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">VAT Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.vatRegistered} onChange={(e) => { set('vatRegistered', e.target.checked); flash(); }}
                  className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">VAT Registered</span>
              </label>
            </div>
            {settings.vatRegistered && (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">VAT Scheme</span>
                  <select value={settings.vatScheme} onChange={(e) => { set('vatScheme', e.target.value as Settings['vatScheme']); flash(); }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                    <option value="standard">Standard</option>
                    <option value="flat-rate">Flat Rate Scheme</option>
                    <option value="cash-accounting">Cash Accounting</option>
                  </select>
                </label>
                {settings.vatScheme === 'flat-rate' && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Flat Rate (%)</span>
                    <input type="number" min="0" max="100" step="0.5" value={settings.vatFlatRate}
                      onChange={(e) => { set('vatFlatRate', parseFloat(e.target.value) || 0); flash(); }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
                  </label>
                )}
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">VAT Number</span>
                  <input type="text" value={settings.vatNumber} onChange={(e) => { set('vatNumber', e.target.value); flash(); }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
                    placeholder="GB 123 4567 89" />
                </label>
              </>
            )}
          </div>
        </Card>

        {/* Income Categories */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Income Categories</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {settings.incomeCategories.map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                {cat}
                <button onClick={() => removeCategory('income', cat)} className="ml-0.5 hover:text-red-500">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newIncomeCat} onChange={(e) => setNewIncomeCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory('income')}
              placeholder="New category" className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600" />
            <Button size="sm" variant="secondary" onClick={() => addCategory('income')}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { set('incomeCategories', DEFAULT_INCOME_CATEGORIES); flash(); }}>Reset</Button>
          </div>
        </Card>

        {/* Cost Categories */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cost Categories</h2>
            {settings.taxMode === 'uk-sole-trader' && (
              <Button size="sm" variant="ghost" onClick={() => {
                set('costCategories', UK_COST_CATEGORIES);
                set('costCategoryMeta', DEFAULT_COST_CATEGORY_META);
                flash();
              }}>
                Use UK Categories
              </Button>
            )}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {settings.costCategories.map((cat) => {
              const meta = (settings.costCategoryMeta || []).find((m) => m.name === cat);
              const color = meta?.allowable === 'no'
                ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
                : meta?.allowable === 'partial'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300';
              return (
                <span key={cat} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${color}`}>
                  {cat}
                  {meta?.allowable === 'no' && <span className="text-[10px]">(non-allowable)</span>}
                  {meta?.allowable === 'partial' && <span className="text-[10px]">(partial)</span>}
                  <button onClick={() => removeCategory('cost', cat)} className="ml-0.5 hover:text-red-500">&times;</button>
                </span>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newCostCat} onChange={(e) => setNewCostCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory('cost')}
              placeholder="New category" className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600" />
            <Button size="sm" variant="secondary" onClick={() => addCategory('cost')}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { set('costCategories', DEFAULT_COST_CATEGORIES); set('costCategoryMeta', []); flash(); }}>Reset</Button>
          </div>
        </Card>

        {/* Invoicing Settings */}
        <InvoicingSettingsCard settings={settings} set={set} flash={flash} />

        {/* Data Management */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Data Management</h2>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            All data is stored locally in your browser. Export your data to keep a backup.
          </p>
          <div className="flex flex-wrap gap-2">
            <ExportButton />
            <ExportCSVButton />
            <ImportButton />
          </div>
        </Card>
      </div>
    </>
  );
}

function InvoicingSettingsCard({
  settings,
  set,
  flash,
}: {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, val: Settings[K]) => void;
  flash: () => void;
}) {
  const inv = settings.invoicing || defaultInvoicingSettings;
  const setInv = <K extends keyof InvoicingSettings>(key: K, val: InvoicingSettings[K]) => {
    set('invoicing', { ...inv, [key]: val });
    flash();
  };

  const addRef = () => {
    const ref: ExtraReference = { id: `ref-${Date.now()}`, label: '', value: '', showAtTop: true, showAtBottom: false };
    setInv('extraReferences', [...inv.extraReferences, ref]);
  };

  const updateRef = (id: string, patch: Partial<ExtraReference>) => {
    setInv('extraReferences', inv.extraReferences.map((r) => r.id === id ? { ...r, ...patch } : r));
  };

  const removeRef = (id: string) => {
    setInv('extraReferences', inv.extraReferences.filter((r) => r.id !== id));
  };

  const moveRef = (index: number, delta: number) => {
    const refs = [...inv.extraReferences];
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= refs.length) return;
    [refs[index], refs[newIndex]] = [refs[newIndex], refs[index]];
    setInv('extraReferences', refs);
  };

  const inputCls = "mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600";

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Invoicing</h2>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Defaults for PDF generation and new invoices
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Default Daily Rate</span>
          <input type="number" step="0.01" min="0" value={inv.defaultDailyRate || ''} onChange={(e) => setInv('defaultDailyRate', parseFloat(e.target.value) || 0)}
            className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Default Payment Terms (days)</span>
          <input type="number" min="0" value={inv.defaultPaymentTerms} onChange={(e) => setInv('defaultPaymentTerms', parseInt(e.target.value) || 0)}
            className={inputCls} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Bank Details</span>
          <textarea value={inv.bankDetails} onChange={(e) => setInv('bankDetails', e.target.value)} rows={3}
            className={inputCls} placeholder="Account name, sort code, account number..." />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Default Notes</span>
          <textarea value={inv.defaultNotes} onChange={(e) => setInv('defaultNotes', e.target.value)} rows={2}
            className={inputCls} placeholder="Pre-filled notes for new invoices" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Header Color</span>
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={inv.headerColor} onChange={(e) => setInv('headerColor', e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-slate-300 dark:border-slate-600" />
            <input type="text" value={inv.headerColor} onChange={(e) => setInv('headerColor', e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
              maxLength={7} />
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Body Color</span>
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={inv.bodyColor} onChange={(e) => setInv('bodyColor', e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-slate-300 dark:border-slate-600" />
            <input type="text" value={inv.bodyColor} onChange={(e) => setInv('bodyColor', e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
              maxLength={7} />
          </div>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filename Template</span>
          <input type="text" value={inv.filenameTemplate} onChange={(e) => setInv('filenameTemplate', e.target.value)}
            className={inputCls} />
          <p className="mt-1 text-xs text-slate-400">
            Tokens: [businessname] [invoicenumber] [clientname] [issuedate] [month]
          </p>
        </label>
      </div>

      {/* Extra References */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Extra References</span>
            {inv.extraReferences.length > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">The order below is the order shown in the PDF.</p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={addRef}>+ Add</Button>
        </div>
        {inv.extraReferences.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400 dark:border-slate-700">
            No extra references yet.
          </div>
        ) : (
        <div className="space-y-2">
          {inv.extraReferences.map((ref, i) => (
            <div key={ref.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => moveRef(i, -1)} disabled={i === 0}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-slate-700 dark:hover:text-slate-200">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>
                  </button>
                  <button type="button" onClick={() => moveRef(i, 1)} disabled={i === inv.extraReferences.length - 1}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-slate-700 dark:hover:text-slate-200">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                </div>
                <input type="text" value={ref.label} onChange={(e) => updateRef(ref.id, { label: e.target.value })}
                  placeholder="Label" className="w-32 rounded-lg border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-slate-600" />
                <input type="text" value={ref.value} onChange={(e) => updateRef(ref.id, { value: e.target.value })}
                  placeholder="Value" className="flex-1 rounded-lg border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-slate-600" />
                <button type="button" onClick={() => removeRef(ref.id)}
                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20">Remove</button>
              </div>
              <div className="mt-2 flex gap-4 pl-9">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <input type="checkbox" checked={ref.showAtTop} onChange={(e) => updateRef(ref.id, { showAtTop: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-slate-300" />
                  Show at top
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <input type="checkbox" checked={ref.showAtBottom} onChange={(e) => updateRef(ref.id, { showAtBottom: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-slate-300" />
                  Show at bottom
                </label>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </Card>
  );
}

function ExportButton() {
  const { transactions, clients, invoices, settings, updateSettings } = useApp();
  const handleExport = () => {
    const data = JSON.stringify({ settings, transactions, clients, invoices }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    updateSettings({ ...settings, lastExportDate: todayString() });
  };
  return <Button variant="secondary" size="sm" onClick={handleExport}>Export JSON</Button>;
}

function ExportCSVButton() {
  const { transactions, invoices, settings } = useApp();
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => {
        const csv = exportTransactionsCSV(transactions, settings);
        downloadCsv(csv, `transactions-${todayString()}.csv`);
      }}>
        Export Transactions CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={() => {
        const csv = exportInvoicesCSV(invoices);
        downloadCsv(csv, `invoices-${todayString()}.csv`);
      }}>
        Export Invoices CSV
      </Button>
    </div>
  );
}

function ImportButton() {
  const { updateSettings, ...ctx } = useApp();
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.settings) updateSettings(data.settings);
          if (data.transactions) {
            for (const t of data.transactions) ctx.addTransaction(t);
          }
          if (data.clients) {
            for (const c of data.clients) ctx.addClient(c);
          }
          if (data.invoices) {
            for (const i of data.invoices) ctx.addInvoice(i);
          }
        } catch {
          alert('Invalid file format');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  return <Button variant="ghost" size="sm" onClick={handleImport}>Import Data</Button>;
}
