'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/Card';
import { Modal, Button } from '@/components/Modal';
import { formatCurrency } from '@/lib/utils';
import type { Budget } from '@/lib/types';

type BudgetForm = {
  category: string;
  amount: string;
  period: 'monthly' | 'annual';
};

const emptyForm: BudgetForm = { category: '', amount: '', period: 'monthly' };

export default function BudgetsPage() {
  const { settings, transactions, budgets, addBudget, updateBudget, deleteBudget } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState<BudgetForm>(emptyForm);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'cost'>('all');

  const sym = settings.currencySymbol || '£';
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Get current month date range
  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const monthEnd = currentMonth === 11
    ? `${currentYear + 1}-01-01`
    : `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-01`;

  // Filter transactions to current month
  const currentMonthTransactions = useMemo(
    () => transactions.filter((t) => t.date >= monthStart && t.date < monthEnd),
    [transactions, monthStart, monthEnd]
  );

  // Determine budget type from category
  function getBudgetType(category: string): 'income' | 'cost' {
    if (settings.incomeCategories.includes(category)) return 'income';
    return 'cost';
  }

  // Calculate actual amounts per category for current month
  const actualByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of currentMonthTransactions) {
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return map;
  }, [currentMonthTransactions]);

  // Compute budget rows with actuals
  const budgetRows = useMemo(() => {
    return budgets
      .filter((b) => b.year === currentYear)
      .map((b) => {
        const monthlyAmount = b.period === 'annual' ? b.amount / 12 : b.amount;
        const actual = actualByCategory[b.category] || 0;
        const type = getBudgetType(b.category);
        const pct = monthlyAmount > 0 ? (actual / monthlyAmount) * 100 : 0;
        return { ...b, monthlyAmount, actual, type, pct };
      })
      .filter((b) => typeFilter === 'all' || b.type === typeFilter);
  }, [budgets, actualByCategory, currentYear, typeFilter, settings.incomeCategories]);

  // Summary stats
  const totalBudgetedCosts = budgetRows.filter((b) => b.type === 'cost').reduce((s, b) => s + b.monthlyAmount, 0);
  const totalActualCosts = budgetRows.filter((b) => b.type === 'cost').reduce((s, b) => s + b.actual, 0);
  const costUtilization = totalBudgetedCosts > 0 ? (totalActualCosts / totalBudgetedCosts) * 100 : 0;
  const totalBudgetedIncome = budgetRows.filter((b) => b.type === 'income').reduce((s, b) => s + b.monthlyAmount, 0);
  const totalActualIncome = budgetRows.filter((b) => b.type === 'income').reduce((s, b) => s + b.actual, 0);

  function getBarColor(row: { type: 'income' | 'cost'; pct: number }) {
    if (row.type === 'cost') {
      if (row.pct > 100) return 'bg-red-500';
      if (row.pct > 75) return 'bg-amber-500';
      return 'bg-emerald-500';
    }
    // Income: green if on track (>=75%), amber if low, red if very low
    if (row.pct >= 75) return 'bg-emerald-500';
    if (row.pct >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  }

  function getStatusLabel(row: { type: 'income' | 'cost'; pct: number }) {
    if (row.type === 'cost') {
      if (row.pct > 100) return 'Over budget';
      if (row.pct > 75) return 'Approaching limit';
      return 'Under budget';
    }
    if (row.pct >= 100) return 'Target met';
    if (row.pct >= 75) return 'On track';
    return 'Below target';
  }

  function openAdd() {
    const allCategories = [...settings.costCategories, ...settings.incomeCategories];
    setForm({ ...emptyForm, category: allCategories[0] || '' });
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(b: Budget) {
    setEditing(b);
    setForm({ category: b.category, amount: String(b.amount), period: b.period });
    setShowModal(true);
  }

  function handleSave() {
    const amount = parseFloat(form.amount) || 0;
    if (amount <= 0 || !form.category) return;

    if (editing) {
      updateBudget({ ...editing, category: form.category, amount, period: form.period });
    } else {
      addBudget({ category: form.category, amount, period: form.period, year: currentYear });
    }
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function handleDelete(id: string) {
    if (confirm('Delete this budget?')) {
      deleteBudget(id);
    }
  }

  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Budget vs Actual"
        description={`Tracking for ${monthName}`}
        actions={
          <Button onClick={openAdd}>+ Add Budget</Button>
        }
      />

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Budgeted Costs"
          value={formatCurrency(totalBudgetedCosts, sym)}
          sub="This month"
          color="blue"
        />
        <StatCard
          label="Actual Costs"
          value={formatCurrency(totalActualCosts, sym)}
          sub={`${costUtilization.toFixed(0)}% utilization`}
          color={costUtilization > 100 ? 'red' : costUtilization > 75 ? 'default' : 'green'}
        />
        <StatCard
          label="Income Progress"
          value={formatCurrency(totalActualIncome, sym)}
          sub={totalBudgetedIncome > 0 ? `${((totalActualIncome / totalBudgetedIncome) * 100).toFixed(0)}% of ${formatCurrency(totalBudgetedIncome, sym)} target` : 'No income budgets'}
          color="green"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {(['all', 'cost', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              typeFilter === t
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {t === 'all' ? 'All' : t === 'cost' ? 'Costs' : 'Income'}
          </button>
        ))}
      </div>

      {/* Budget List */}
      {budgetRows.length === 0 ? (
        <EmptyState
          title="No budgets yet"
          description="Add a budget to start tracking spending against targets."
          action={<Button onClick={openAdd}>+ Add Budget</Button>}
        />
      ) : (
        <div className="space-y-3">
          {budgetRows.map((row) => (
            <Card key={row.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {row.category}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.type === 'income'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {row.type}
                    </span>
                    <span className={`text-xs font-medium ${
                      row.type === 'cost'
                        ? row.pct > 100 ? 'text-red-600 dark:text-red-400' : row.pct > 75 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                        : row.pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : row.pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {getStatusLabel(row)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <span>{formatCurrency(row.actual, sym)} / {formatCurrency(row.monthlyAmount, sym)}</span>
                    <span className="text-xs">({row.pct.toFixed(0)}%)</span>
                    {row.period === 'annual' && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        (annual: {formatCurrency(row.amount, sym)})
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all ${getBarColor(row)}`}
                      style={{ width: `${Math.min(row.pct, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(row)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    title="Edit"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(row.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Edit Budget' : 'Add Budget'}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <optgroup label="Costs">
                {settings.costCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </optgroup>
              <optgroup label="Income">
                {settings.incomeCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Amount ({sym})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Period</label>
            <select
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value as 'monthly' | 'annual' })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual (divided by 12)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Budget'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
