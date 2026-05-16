'use client';

import { useState } from 'react';
import { useApp } from '@/lib/context';
import type { Settings, TaxMode } from '@/lib/types';
import { UK_COST_CATEGORIES, DEFAULT_COST_CATEGORY_META } from '@/lib/defaults';

const CURRENCY_PRESETS = [
  { symbol: '£', label: 'GBP (£)' },
  { symbol: '$', label: 'USD ($)' },
  { symbol: '€', label: 'EUR (€)' },
  { symbol: 'A$', label: 'AUD (A$)' },
  { symbol: '₹', label: 'INR (₹)' },
];

const TAX_YEAR_OPTIONS: { value: Settings['taxYear']; label: string }[] = [
  { value: 'apr-mar', label: 'April – March' },
  { value: 'calendar', label: 'January – December' },
  { value: 'jul-jun', label: 'July – June' },
  { value: 'oct-sep', label: 'October – September' },
];

const TAX_MODE_OPTIONS: { value: TaxMode; label: string; description: string }[] = [
  {
    value: 'uk-sole-trader',
    label: 'UK Sole Trader',
    description: 'Income Tax bands + Class 2 & 4 National Insurance, calculated automatically from your profit',
  },
  {
    value: 'flat',
    label: 'Flat percentage',
    description: 'Apply a single tax rate to your profit — set the percentage yourself',
  },
];

const STEPS = ['Currency', 'Financial year', 'Tax'] as const;

export default function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const { settings, updateSettings } = useApp();
  const [step, setStep] = useState(0);

  const [currency, setCurrency] = useState(settings.currencySymbol);
  const [customCurrency, setCustomCurrency] = useState('');
  const [taxYear, setTaxYear] = useState<Settings['taxYear']>(settings.taxYear);
  const [taxMode, setTaxMode] = useState<TaxMode>(settings.taxMode);
  const [flatRate, setFlatRate] = useState(settings.taxRate);

  const isCustomCurrency = !CURRENCY_PRESETS.some((p) => p.symbol === currency);

  function finish() {
    const finalCurrency = isCustomCurrency ? customCurrency || currency : currency;
    const isUK = taxMode === 'uk-sole-trader';
    updateSettings({
      ...settings,
      currencySymbol: finalCurrency,
      taxYear,
      taxMode,
      taxRate: taxMode === 'flat' ? flatRate : settings.taxRate,
      locale: isUK ? 'en-GB' : settings.locale,
      accountingBasis: isUK ? 'cash' : settings.accountingBasis,
      costCategories: isUK ? UK_COST_CATEGORIES : settings.costCategories,
      costCategoryMeta: isUK ? DEFAULT_COST_CATEGORY_META : settings.costCategoryMeta,
    });
    onComplete();
  }

  const canAdvance =
    step === 0
      ? (isCustomCurrency ? customCurrency.trim().length > 0 : true)
      : true;

  const handleCurrencySelect = (symbol: string) => {
    setCurrency(symbol);
    setCustomCurrency('');
    if (symbol === '£') {
      setTaxYear('apr-mar');
      setTaxMode('uk-sole-trader');
    }
  };

  const handleTaxModeSelect = (mode: TaxMode) => {
    setTaxMode(mode);
    if (mode === 'uk-sole-trader' && currency !== '£') {
      setCurrency('£');
      setTaxYear('apr-mar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        {/* Header */}
        <div className="px-6 pt-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Welcome to Accounts
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Quick setup — you can change these anytime in Settings.
          </p>

          {/* Progress */}
          <div className="mt-4 flex gap-1.5">
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1">
                <div
                  className={`h-1 rounded-full transition-colors ${
                    i <= step ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
                <p className={`mt-1 text-[10px] font-medium ${
                  i <= step ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === 0 && (
            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
                What currency do you use?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CURRENCY_PRESETS.map((p) => (
                  <button
                    key={p.symbol}
                    onClick={() => handleCurrencySelect(p.symbol)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      currency === p.symbol
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-400'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setCurrency('__custom__')}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    isCustomCurrency
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-400'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  Other…
                </button>
              </div>
              {isCustomCurrency && (
                <input
                  type="text"
                  value={customCurrency}
                  onChange={(e) => setCustomCurrency(e.target.value)}
                  placeholder="e.g. ¥, R, kr"
                  maxLength={5}
                  autoFocus
                  className="mt-3 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
                />
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
                When does your financial year start?
              </label>
              <div className="space-y-2">
                {TAX_YEAR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTaxYear(opt.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      taxYear === opt.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-400'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
                How should we estimate your tax?
              </label>
              <div className="space-y-2">
                {TAX_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleTaxModeSelect(opt.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      taxMode === opt.value
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15 dark:border-brand-400'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className={`block text-sm font-medium ${
                      taxMode === opt.value
                        ? 'text-brand-700 dark:text-brand-300'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {opt.label}
                    </span>
                    <span className={`mt-0.5 block text-xs ${
                      taxMode === opt.value
                        ? 'text-brand-600/70 dark:text-brand-400/70'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
              {taxMode === 'flat' && (
                <label className="mt-3 block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tax rate (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={flatRate}
                    onChange={(e) => setFlatRate(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Back
            </button>
          ) : (
            <button
              onClick={finish}
              className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              Skip
            </button>
          )}
          <button
            onClick={() => {
              if (step < STEPS.length - 1) setStep((s) => s + 1);
              else finish();
            }}
            disabled={!canAdvance}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {step < STEPS.length - 1 ? 'Next' : 'Get started'}
          </button>
        </div>
      </div>
    </div>
  );
}
