'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader, StatCard } from '@/components/Card';
import { formatCurrency, formatMonth, getYearRange, isInRange, getFinancialYear, todayString } from '@/lib/utils';

export default function CashFlowPage() {
  const { settings, transactions, invoices } = useApp();
  const sym = settings.currencySymbol || '£';
  const today = todayString();
  const currentYear = getFinancialYear(today, settings.taxYear);
  const yearRange = getYearRange(currentYear, settings.taxYear);

  const monthlyActual = useMemo(() => {
    const months: Record<string, { income: number; costs: number }> = {};
    const yearTx = transactions.filter((t) => isInRange(t.date, yearRange.start, yearRange.end));
    for (const t of yearTx) {
      const m = t.date.slice(0, 7);
      if (!months[m]) months[m] = { income: 0, costs: 0 };
      if (t.type === 'income') months[m].income += t.amount;
      else months[m].costs += t.amount;
    }
    return months;
  }, [transactions, yearRange]);

  const forecast = useMemo(() => {
    const months: { month: string; income: number; costs: number; net: number; cumulative: number; isProjected: boolean }[] = [];

    // Historical average for projections
    const pastMonths = Object.values(monthlyActual);
    const avgIncome = pastMonths.length > 0 ? pastMonths.reduce((s, m) => s + m.income, 0) / pastMonths.length : 0;
    const avgCosts = pastMonths.length > 0 ? pastMonths.reduce((s, m) => s + m.costs, 0) / pastMonths.length : 0;

    // Outstanding invoices by due month
    const outstandingByMonth: Record<string, number> = {};
    for (const inv of invoices) {
      if (inv.status === 'sent' || inv.status === 'overdue') {
        const m = (inv.dueDate || inv.issueDate).slice(0, 7);
        outstandingByMonth[m] = (outstandingByMonth[m] || 0) + inv.amount;
      }
    }

    // Recurring transaction projections
    const recurringIncome = transactions
      .filter((t) => t.recurrence?.active && t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const recurringCosts = transactions
      .filter((t) => t.recurrence?.active && t.type === 'cost')
      .reduce((s, t) => s + t.amount, 0);

    let cumulative = 0;
    const currentMonth = today.slice(0, 7);

    // Generate 12 months from start of year
    const startDate = new Date(yearRange.start);
    for (let i = 0; i < 12; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const m = d.toISOString().slice(0, 7);
      const isProjected = m > currentMonth;

      let income: number;
      let costs: number;

      if (monthlyActual[m]) {
        income = monthlyActual[m].income;
        costs = monthlyActual[m].costs;
      } else if (isProjected) {
        income = (outstandingByMonth[m] || 0) + recurringIncome || avgIncome;
        costs = recurringCosts || avgCosts;
      } else {
        income = 0;
        costs = 0;
      }

      const net = income - costs;
      cumulative += net;
      months.push({ month: m, income, costs, net, cumulative, isProjected });
    }

    return months;
  }, [monthlyActual, invoices, transactions, today, yearRange]);

  const maxCumulative = Math.max(...forecast.map((m) => Math.abs(m.cumulative)), 1);
  const goesNegative = forecast.some((m) => m.cumulative < 0);

  return (
    <>
      <PageHeader title="Cash Flow" description="Actual and projected cash flow for the year" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Current Position" value={formatCurrency(forecast.find((m) => m.month === today.slice(0, 7))?.cumulative || 0, sym)} color="blue" />
        <StatCard label="Projected Year-End" value={formatCurrency(forecast[forecast.length - 1]?.cumulative || 0, sym)} color={forecast[forecast.length - 1]?.cumulative >= 0 ? 'green' : 'red'} />
        <StatCard label="Outstanding Invoices" value={formatCurrency(invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0), sym)} color="blue" />
        {goesNegative && <StatCard label="Warning" value="Negative forecast" color="red" sub="Cash may run out" />}
      </div>

      {/* Visual chart */}
      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Cash Flow Forecast</h2>
        <div className="space-y-2">
          {forecast.map((m) => {
            const barWidth = Math.abs(m.cumulative) / maxCumulative * 100;
            return (
              <div key={m.month} className={`text-xs ${m.isProjected ? 'opacity-60' : ''}`}>
                <div className="mb-1 flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{formatMonth(m.month + '-01', settings.locale)} {m.isProjected && '(projected)'}</span>
                  <span className={m.cumulative >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    {formatCurrency(m.cumulative, sym)}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className={`h-3 rounded-full ${m.cumulative >= 0 ? 'bg-emerald-500' : 'bg-red-400'} ${m.isProjected ? 'opacity-50 border border-dashed border-slate-300' : ''}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Monthly detail table */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Monthly Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-700">
                <th className="pb-2">Month</th>
                <th className="pb-2 text-right">Income</th>
                <th className="pb-2 text-right">Costs</th>
                <th className="pb-2 text-right">Net</th>
                <th className="pb-2 text-right">Cumulative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {forecast.map((m) => (
                <tr key={m.month} className={m.isProjected ? 'opacity-60 italic' : ''}>
                  <td className="py-2 text-slate-600 dark:text-slate-400">
                    {formatMonth(m.month + '-01', settings.locale)}
                    {m.isProjected && <span className="ml-1 text-[10px] not-italic text-slate-400">est.</span>}
                  </td>
                  <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(m.income, sym)}</td>
                  <td className="py-2 text-right text-red-600 dark:text-red-400">{formatCurrency(m.costs, sym)}</td>
                  <td className={`py-2 text-right font-medium ${m.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(m.net, sym)}</td>
                  <td className={`py-2 text-right font-semibold ${m.cumulative >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(m.cumulative, sym)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
