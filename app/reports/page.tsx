'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader, StatCard } from '@/components/Card';
import { formatCurrency, formatMonth, getYearRange, isInRange } from '@/lib/utils';

export default function ReportsPage() {
  const { ready, settings, transactions } = useApp();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const yearRange = getYearRange(year, settings.taxYear);

  const sym = settings.currencySymbol || '$';

  const yearTx = useMemo(
    () => transactions.filter((t) => isInRange(t.date, yearRange.start, yearRange.end)),
    [transactions, yearRange]
  );

  const pnl = useMemo(() => {
    const income = yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const costs = yearTx.filter((t) => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
    const net = income - costs;
    const estimatedTax = settings.taxRate > 0 ? net * (settings.taxRate / 100) : 0;
    return { income, costs, net, estimatedTax, afterTax: net - estimatedTax };
  }, [yearTx, settings.taxRate]);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of yearTx.filter((t) => t.type === 'income')) {
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [yearTx]);

  const costByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of yearTx.filter((t) => t.type === 'cost')) {
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [yearTx]);

  const monthlyPnl = useMemo(() => {
    const months: Record<string, { income: number; costs: number }> = {};
    for (const t of yearTx) {
      const m = t.date.slice(0, 7);
      if (!months[m]) months[m] = { income: 0, costs: 0 };
      if (t.type === 'income') months[m].income += t.amount;
      else months[m].costs += t.amount;
    }
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data, net: data.income - data.costs }));
  }, [yearTx]);

  if (!ready) return null;

  const yearLabel = settings.taxYear !== 'calendar'
    ? `${year}/${String(year + 1).slice(2)}`
    : `${year}`;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Financial year ${yearLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setYear((y) => y - 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">&larr;</button>
            <span className="min-w-[4rem] text-center text-sm font-medium">{yearLabel}</span>
            <button onClick={() => setYear((y) => y + 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">&rarr;</button>
          </div>
        }
      />

      {/* P&L Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Income" value={formatCurrency(pnl.income, sym)} color="green" />
        <StatCard label="Total Costs" value={formatCurrency(pnl.costs, sym)} color="red" />
        <StatCard label="Net Profit" value={formatCurrency(pnl.net, sym)} color={pnl.net >= 0 ? 'green' : 'red'} />
        <StatCard label={`Est. Tax (${settings.taxRate}%)`} value={formatCurrency(pnl.estimatedTax, sym)} color="red" />
        <StatCard label="After Tax" value={formatCurrency(pnl.afterTax, sym)} color={pnl.afterTax >= 0 ? 'green' : 'red'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income by Category */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Income by Category</h2>
          {incomeByCategory.length === 0 ? (
            <p className="text-sm text-slate-500">No income recorded</p>
          ) : (
            <div className="space-y-2">
              {incomeByCategory.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">{cat}</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(amt, sym)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${(amt / pnl.income) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Costs by Category */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Costs by Category</h2>
          {costByCategory.length === 0 ? (
            <p className="text-sm text-slate-500">No costs recorded</p>
          ) : (
            <div className="space-y-2">
              {costByCategory.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">{cat}</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(amt, sym)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-2 rounded-full bg-red-400"
                      style={{ width: `${(amt / pnl.costs) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Monthly P&L Table */}
      <Card className="mt-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Monthly Profit & Loss</h2>
        {monthlyPnl.length === 0 ? (
          <p className="text-sm text-slate-500">No transactions this year</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-700">
                  <th className="pb-2">Month</th>
                  <th className="pb-2 text-right">Income</th>
                  <th className="pb-2 text-right">Costs</th>
                  <th className="pb-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {monthlyPnl.map((m) => (
                  <tr key={m.month}>
                    <td className="py-2 text-slate-600 dark:text-slate-400">{formatMonth(m.month + '-01')}</td>
                    <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(m.income, sym)}</td>
                    <td className="py-2 text-right text-red-600 dark:text-red-400">{formatCurrency(m.costs, sym)}</td>
                    <td className={`py-2 text-right font-semibold ${m.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(m.net, sym)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="pt-3 text-slate-900 dark:text-slate-100">Total</td>
                  <td className="pt-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(pnl.income, sym)}</td>
                  <td className="pt-3 text-right text-red-600 dark:text-red-400">{formatCurrency(pnl.costs, sym)}</td>
                  <td className={`pt-3 text-right ${pnl.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(pnl.net, sym)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
