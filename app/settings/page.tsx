'use client';

import { useCallback, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader } from '@/components/Card';
import { Button } from '@/components/Modal';
import type { Settings } from '@/lib/types';
import { DEFAULT_COST_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/lib/defaults';

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
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Business Name</span>
              <input type="text" value={settings.businessName} onChange={(e) => { set('businessName', e.target.value); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Email</span>
              <input type="email" value={settings.email} onChange={(e) => { set('email', e.target.value); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Phone</span>
              <input type="tel" value={settings.phone} onChange={(e) => { set('phone', e.target.value); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Currency Symbol</span>
              <input type="text" value={settings.currencySymbol} onChange={(e) => { set('currencySymbol', e.target.value); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" maxLength={5} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Business Address</span>
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
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Financial Year</span>
              <select value={settings.taxYear} onChange={(e) => { set('taxYear', e.target.value as Settings['taxYear']); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                <option value="calendar">Calendar Year (Jan - Dec)</option>
                <option value="apr-mar">Apr - Mar (UK/India)</option>
                <option value="jul-jun">Jul - Jun (Australia)</option>
                <option value="oct-sep">Oct - Sep (US Federal)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tax Calculation</span>
              <select value={settings.taxMode} onChange={(e) => { set('taxMode', e.target.value as Settings['taxMode']); flash(); }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600">
                <option value="flat">Flat Rate</option>
                <option value="uk-sole-trader">UK Sole Trader (Income Tax + NI)</option>
              </select>
            </label>
            {settings.taxMode === 'flat' && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Estimated Tax Rate (%)</span>
                <input type="number" min="0" max="100" step="0.5" value={settings.taxRate} onChange={(e) => { set('taxRate', parseFloat(e.target.value) || 0); flash(); }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600" />
              </label>
            )}
            {settings.taxMode === 'uk-sole-trader' && (
              <div className="sm:col-span-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                UK Income Tax bands, Class 2 and Class 4 National Insurance will be calculated automatically based on your net profit. Rates are based on the 2024/25 tax year.
              </div>
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
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Cost Categories</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {settings.costCategories.map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                {cat}
                <button onClick={() => removeCategory('cost', cat)} className="ml-0.5 hover:text-red-500">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newCostCat} onChange={(e) => setNewCostCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory('cost')}
              placeholder="New category" className="flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600" />
            <Button size="sm" variant="secondary" onClick={() => addCategory('cost')}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { set('costCategories', DEFAULT_COST_CATEGORIES); flash(); }}>Reset</Button>
          </div>
        </Card>

        {/* Data Management */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Data Management</h2>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            All data is stored locally in your browser. Export your data to keep a backup.
          </p>
          <div className="flex gap-2">
            <ExportButton />
            <ImportButton />
          </div>
        </Card>
      </div>
    </>
  );
}

function ExportButton() {
  const { transactions, clients, invoices, settings } = useApp();
  const handleExport = () => {
    const data = JSON.stringify({ settings, transactions, clients, invoices }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return <Button variant="secondary" size="sm" onClick={handleExport}>Export Data</Button>;
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
