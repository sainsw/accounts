'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/Card';
import { formatCurrency, formatDate, formatMonth, getYearRange, isInRange, monthString, getFinancialYear } from '@/lib/utils';
import { calculateUKTax, calculateFlatTax } from '@/lib/tax';
import Link from 'next/link';

export default function Dashboard() {
  const { ready, settings, transactions, invoices, updateSettings } = useApp();
  const [backupDismissed, setBackupDismissed] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const currentYear = getFinancialYear(today, settings.taxYear);
  const yearRange = getYearRange(currentYear, settings.taxYear);
  const curMonth = monthString();

  const stats = useMemo(() => {
    const yearTx = transactions.filter((t) =>
      isInRange(t.date, yearRange.start, yearRange.end)
    );
    const monthTx = transactions.filter((t) => t.date.startsWith(curMonth));

    const yearIncome = yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const yearCosts = yearTx.filter((t) => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
    const yearAllowableCosts = yearTx.filter((t) => t.type === 'cost' && t.taxDeductible !== false).reduce((s, t) => s + t.amount, 0);
    const monthIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthCosts = monthTx.filter((t) => t.type === 'cost').reduce((s, t) => s + t.amount, 0);

    const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
    const outstandingTotal = outstanding.reduce((s, i) => s + i.amount, 0);
    const overdueCount = invoices.filter((i) => i.status === 'overdue').length;

    const yearNet = yearIncome - yearCosts;
    const taxableNet = yearIncome - yearAllowableCosts;

    const tax = settings.taxMode === 'uk-sole-trader'
      ? calculateUKTax(taxableNet, {
          year: currentYear,
          grossIncome: yearIncome,
          allowableCosts: yearAllowableCosts,
          voluntaryClass2NI: settings.voluntaryClass2NI,
          studentLoanPlan: settings.studentLoanPlan,
        })
      : calculateFlatTax(yearNet, settings.taxRate);

    return {
      yearIncome,
      yearCosts,
      yearNet,
      monthIncome,
      monthCosts,
      monthNet: monthIncome - monthCosts,
      outstandingTotal,
      outstandingCount: outstanding.length,
      overdueCount,
      tax,
    };
  }, [transactions, invoices, yearRange, curMonth, settings, currentYear]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [transactions]
  );

  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; costs: number }> = {};
    const yearTx = transactions.filter((t) => isInRange(t.date, yearRange.start, yearRange.end));
    for (const t of yearTx) {
      const m = t.date.slice(0, 7);
      if (!months[m]) months[m] = { income: 0, costs: 0 };
      if (t.type === 'income') months[m].income += t.amount;
      else months[m].costs += t.amount;
    }
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data, net: data.income - data.costs }));
  }, [transactions, yearRange]);

  if (!ready) return null;

  const sym = settings.currencySymbol || '$';
  const locale = settings.locale || 'en-US';

  const showBackupReminder = !backupDismissed && (() => {
    if (!settings.lastExportDate) return transactions.length > 0;
    const lastExport = new Date(settings.lastExportDate);
    const daysSince = Math.floor((Date.now() - lastExport.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince >= 30;
  })();

  const daysSinceExport = settings.lastExportDate
    ? Math.floor((Date.now() - new Date(settings.lastExportDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Financial year ${yearRange.start.slice(0, 4)}${settings.taxYear !== 'calendar' ? '/' + yearRange.end.slice(2, 4) : ''}`}
      />

      {/* Backup reminder */}
      {showBackupReminder && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {daysSinceExport !== null
              ? `You haven't backed up your data in ${daysSinceExport} days.`
              : "You haven't exported a backup yet."}
            {' '}
            <Link href="/settings" className="font-medium underline">Export now?</Link>
          </p>
          <button onClick={() => setBackupDismissed(true)} className="ml-3 text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Year Income" value={formatCurrency(stats.yearIncome, sym)} color="green" />
        <StatCard label="Year Costs" value={formatCurrency(stats.yearCosts, sym)} color="red" />
        <StatCard label="Year Net" value={formatCurrency(stats.yearNet, sym)} color={stats.yearNet >= 0 ? 'green' : 'red'} />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats.outstandingTotal, sym)}
          sub={
            stats.outstandingCount > 0
              ? `${stats.outstandingCount} invoice${stats.outstandingCount !== 1 ? 's' : ''}${stats.overdueCount > 0 ? `, ${stats.overdueCount} overdue` : ''}`
              : 'No outstanding invoices'
          }
          color="blue"
        />
      </div>

      {/* Tax estimate row */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label={`${formatMonth(curMonth + '-01', locale)} Income`} value={formatCurrency(stats.monthIncome, sym)} color="green" />
        <StatCard label={`${formatMonth(curMonth + '-01', locale)} Costs`} value={formatCurrency(stats.monthCosts, sym)} color="red" />
        <StatCard label={`${formatMonth(curMonth + '-01', locale)} Net`} value={formatCurrency(stats.monthNet, sym)} color={stats.monthNet >= 0 ? 'green' : 'red'} />
        <StatCard label="Est. Tax" value={formatCurrency(stats.tax.totalTax, sym)} color="red" />
        <StatCard label="After Tax" value={formatCurrency(stats.tax.afterTax, sym)} color={stats.tax.afterTax >= 0 ? 'green' : 'red'} />
      </div>

      {/* VAT summary card */}
      {settings.vatRegistered && (
        <div className="mt-4">
          <Link href="/vat">
            <Card className="hover:border-brand-300 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">VAT</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">View VAT Return</p>
                </div>
                <span className="text-brand-500 text-sm">&rarr;</span>
              </div>
            </Card>
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Monthly Breakdown</h2>
          {monthlyData.length === 0 ? (
            <p className="text-sm text-slate-500">
              No transactions this year yet.{' '}
              <Link href="/transactions" className="text-brand-500 hover:underline">Add one</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {monthlyData.map((m) => {
                const max = Math.max(...monthlyData.map((d) => Math.max(d.income, d.costs)), 1);
                return (
                  <div key={m.month} className="text-xs">
                    <div className="mb-1 flex justify-between text-slate-600 dark:text-slate-400">
                      <span>{formatMonth(m.month + '-01', locale)}</span>
                      <span className={m.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {formatCurrency(m.net, sym)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(m.income / max) * 100}%` }} />
                      <div className="h-2 rounded-full bg-red-400" style={{ width: `${(m.costs / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Transactions</h2>
            <Link href="/transactions" className="text-xs font-medium text-brand-500 hover:underline">View all</Link>
          </div>
          {recentTransactions.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="Start tracking your income and costs"
              action={
                <Link href="/transactions" className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
                  Add transaction
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{t.description}</p>
                    <p className="text-xs text-slate-500">{formatDate(t.date, locale)} &middot; {t.category}</p>
                  </div>
                  <span className={`ml-3 shrink-0 text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, sym)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
