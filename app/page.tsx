'use client';

import { useMemo, useState, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/Card';
import { TransactionsIcon, ClientsIcon, InvoicesIcon, type IconProps } from '@/components/nav-shared';
import { formatCurrency, formatDate, formatMonth, getYearRange, isInRange, monthString, getFinancialYear, todayString, generateId } from '@/lib/utils';
import { calculateUKTax, calculateFlatTax } from '@/lib/tax';
import { generateTaxHints, suggestCategory } from '@/lib/smart-categorisation';
import Link from 'next/link';

export default function Dashboard() {
  const { ready, settings, transactions, invoices, clients, updateSettings, mileageEntries, wfhEntries, addTransaction, categorisationRules, updateTransaction } = useApp();
  const [backupDismissed, setBackupDismissed] = useState(false);
  const [dismissedHints, setDismissedHints] = useState<string[]>([]);
  const [quickDesc, setQuickDesc] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickType, setQuickType] = useState<'income' | 'cost'>('cost');

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

    const unreconciledCount = transactions.filter((t) => t.reconciliationStatus === 'unreconciled').length;

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
      unreconciledCount,
    };
  }, [transactions, invoices, yearRange, curMonth, settings, currentYear]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [transactions]
  );

  const priorYearRange = getYearRange(currentYear - 1, settings.taxYear);

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

  const priorYearData = useMemo(() => {
    const priorTx = transactions.filter((t) => isInRange(t.date, priorYearRange.start, priorYearRange.end));
    const priorIncome = priorTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const priorCosts = priorTx.filter((t) => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
    return { income: priorIncome, costs: priorCosts, net: priorIncome - priorCosts };
  }, [transactions, priorYearRange]);

  const handleQuickAdd = useCallback(() => {
    const amount = parseFloat(quickAmount);
    if (!quickDesc.trim() || !amount || amount <= 0) return;
    addTransaction({
      date: todayString(),
      type: quickType,
      amount,
      description: quickDesc.trim(),
      category: quickType === 'income' ? 'Other Income' : 'Other Cost',
      clientId: null,
      invoiceId: null,
      projectId: null,
      notes: 'Added via quick entry',
      vatRate: null,
      vatAmount: 0,
      taxDeductible: quickType === 'cost',
      attachments: [],
      currency: null,
      exchangeRate: null,
      originalAmount: null,
      recurrence: null,
      reconciliationStatus: 'unreconciled',
      importedFrom: null,
    });
    setQuickDesc('');
    setQuickAmount('');
  }, [quickDesc, quickAmount, quickType, addTransaction]);

  // Next tax deadline
  const nextDeadline = useMemo(() => {
    if (settings.taxMode !== 'uk-sole-trader') return null;
    const yr = currentYear;
    const deadlines = [
      { date: `${yr + 1}-01-31`, label: 'Self Assessment + Balancing Payment' },
      { date: `${yr + 1}-07-31`, label: '2nd Payment on Account' },
    ];
    if (settings.vatRegistered) {
      deadlines.push(
        { date: `${yr}-05-07`, label: 'VAT Q1 Return' },
        { date: `${yr}-08-07`, label: 'VAT Q2 Return' },
        { date: `${yr}-11-07`, label: 'VAT Q3 Return' },
        { date: `${yr + 1}-02-07`, label: 'VAT Q4 Return' },
      );
    }
    const upcoming = deadlines
      .filter((d) => d.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (upcoming.length === 0) return null;
    const next = upcoming[0];
    const daysUntil = Math.ceil((new Date(next.date).getTime() - new Date(today).getTime()) / 86400000);
    return { ...next, daysUntil, estimatedTax: stats.tax.totalTax };
  }, [settings.taxMode, settings.vatRegistered, currentYear, today, stats.tax.totalTax]);

  // Health check
  const healthCheck = useMemo(() => {
    const issues: { label: string; severity: 'warning' | 'info'; href: string }[] = [];
    if (!settings.lastExportDate || ((Date.now() - new Date(settings.lastExportDate).getTime()) / 86400000) >= 30) {
      issues.push({ label: 'Backup overdue', severity: 'warning', href: '/settings' });
    }
    if (stats.unreconciledCount > 0) {
      issues.push({ label: `${stats.unreconciledCount} unreconciled`, severity: 'info', href: '/transactions' });
    }
    if (stats.overdueCount > 0) {
      issues.push({ label: `${stats.overdueCount} overdue invoice${stats.overdueCount > 1 ? 's' : ''}`, severity: 'warning', href: '/invoices' });
    }
    return issues;
  }, [settings.lastExportDate, stats.unreconciledCount, stats.overdueCount]);

  if (!ready) return null;

  // Brand-new account: a guided home beats a wall of £0 stats. This melts away
  // automatically as soon as the first transaction is recorded.
  if (transactions.length === 0) {
    return <GettingStarted hasClients={clients.length > 0} hasInvoices={invoices.length > 0} />;
  }

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

      {/* Year-on-year comparison */}
      {priorYearData.income > 0 && (
        <div className="mt-2 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
          {[
            { label: 'Income', current: stats.yearIncome, prior: priorYearData.income },
            { label: 'Costs', current: stats.yearCosts, prior: priorYearData.costs },
            { label: 'Net', current: stats.yearNet, prior: priorYearData.net },
          ].map(({ label, current, prior }) => {
            const pct = prior !== 0 ? ((current - prior) / Math.abs(prior)) * 100 : 0;
            return (
              <span key={label} className="flex items-center gap-1">
                {label}:
                <span className={pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {pct >= 0 ? '↑' : '↓'}{Math.abs(pct).toFixed(0)}%
                </span>
                vs last year
              </span>
            );
          })}
        </div>
      )}

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

      {/* Tax deadline countdown */}
      {nextDeadline && (
        <div className="mt-4">
          <Link href="/reports/tax-calendar">
            <Card className="hover:border-brand-300 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Next Tax Deadline</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{nextDeadline.label}</p>
                  <p className="text-xs text-slate-500">{formatDate(nextDeadline.date, locale)} &middot; Est. {formatCurrency(nextDeadline.estimatedTax, sym)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${nextDeadline.daysUntil <= 30 ? 'text-red-600 dark:text-red-400' : nextDeadline.daysUntil <= 90 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {nextDeadline.daysUntil}
                  </p>
                  <p className="text-xs text-slate-500">days</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Tax Optimisation Hints */}
      {settings.taxMode === 'uk-sole-trader' && (() => {
        const hints = generateTaxHints(transactions, mileageEntries, wfhEntries, settings).filter((h) => !dismissedHints.includes(h.id));
        if (hints.length === 0) return null;
        return (
          <div className="mt-4">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Tax Hints</h2>
              <div className="space-y-2">
                {hints.map((hint) => (
                  <div key={hint.id} className="flex items-start justify-between rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-500/20 dark:bg-blue-500/5">
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">{hint.title}</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">{hint.description}</p>
                    </div>
                    <button onClick={() => setDismissedHints((prev) => [...prev, hint.id])} className="ml-2 shrink-0 text-xs text-blue-400 hover:text-blue-600">
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Category suggestions for uncategorised transactions */}
      {(() => {
        const uncategorised = transactions.filter((t) => !t.category || t.category.startsWith('Other'));
        const suggestions = uncategorised.slice(0, 5).map((t) => {
          const suggested = suggestCategory(t.description, t.type, categorisationRules, transactions);
          return suggested ? { transaction: t, suggested } : null;
        }).filter(Boolean) as { transaction: typeof transactions[0]; suggested: string }[];
        if (suggestions.length === 0) return null;
        return (
          <div className="mt-4">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Category Suggestions</h2>
              <div className="space-y-2">
                {suggestions.map(({ transaction: t, suggested }) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{t.description}</p>
                      <p className="text-xs text-slate-500">{formatCurrency(t.amount, sym)} &middot; {t.category || 'Uncategorised'}</p>
                    </div>
                    <button
                      onClick={() => updateTransaction({ ...t, category: suggested })}
                      className="ml-3 shrink-0 rounded-lg bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300"
                    >
                      &rarr; {suggested}
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Health check */}
      {healthCheck.length > 0 && (
        <div className="mt-4">
          <Card>
            <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Health Check</h2>
            <div className="flex flex-wrap gap-2">
              {healthCheck.map((issue) => (
                <Link key={issue.label} href={issue.href}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    issue.severity === 'warning'
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-300'
                  }`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${issue.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  {issue.label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Quick links to reports */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Link href="/reports/cash-flow" className="rounded-lg border border-slate-200 p-3 text-center text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
          Cash Flow Forecast
        </Link>
        <Link href="/reports/balance-sheet" className="rounded-lg border border-slate-200 p-3 text-center text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
          Balance Sheet
        </Link>
        <Link href="/reports/tax-calendar" className="rounded-lg border border-slate-200 p-3 text-center text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
          Tax Calendar
        </Link>
      </div>

      {/* Quick entry */}
      <div className="mt-4">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Quick Entry</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={() => setQuickType('cost')}
                className={`px-3 py-1.5 text-xs font-medium rounded-l-lg ${quickType === 'cost' ? 'bg-red-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                Cost
              </button>
              <button onClick={() => setQuickType('income')}
                className={`px-3 py-1.5 text-xs font-medium rounded-r-lg ${quickType === 'income' ? 'bg-emerald-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                Income
              </button>
            </div>
            <input
              type="text"
              placeholder="Description"
              value={quickDesc}
              onChange={(e) => setQuickDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              className="flex-1 min-w-[140px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="number"
              placeholder="Amount"
              value={quickAmount}
              onChange={(e) => setQuickAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              step="0.01"
              min="0"
            />
            <button
              onClick={handleQuickAdd}
              disabled={!quickDesc.trim() || !quickAmount}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </Card>
      </div>

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

function GettingStarted({ hasClients, hasInvoices }: { hasClients: boolean; hasInvoices: boolean }) {
  return (
    <>
      <PageHeader
        title="Welcome 👋"
        description="You're all set up. Here's how to get going — pick whatever you need first."
      />

      <Card className="mb-6 bg-brand-50/60 dark:bg-brand-500/10">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          This is your <strong>Home</strong> screen. Once you start recording money coming in and
          going out, it fills up with your totals, estimated tax and recent activity. Nothing to set
          up first — just add your first entry below.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StartCard
          icon={TransactionsIcon}
          title="Record money in or out"
          body="Log income you've received or something you paid for. Start here — it's the heart of the app."
          cta="Add your first entry"
          href="/transactions?new=1"
          primary
          done={false}
        />
        <StartCard
          icon={ClientsIcon}
          title="Add a client"
          body="Save the people or companies you work for so you can link income and invoices to them."
          cta={hasClients ? 'Add another client' : 'Add a client'}
          href="/clients?new=1"
          done={hasClients}
        />
        <StartCard
          icon={InvoicesIcon}
          title="Create an invoice"
          body="Bill a client and keep track of what's been paid and what's still outstanding."
          cta={hasInvoices ? 'Create another invoice' : 'Create an invoice'}
          href="/invoices?new=1"
          done={hasInvoices}
        />
      </div>

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        Everything lives in the menu — Money in &amp; out, Invoices, Clients, Expenses and more. You
        can change currency, tax and other details anytime in Settings.
      </p>
    </>
  );
}

function StartCard({
  icon: Icon,
  title,
  body,
  cta,
  href,
  primary = false,
  done = false,
}: {
  icon: React.ComponentType<IconProps>;
  title: string;
  body: string;
  cta: string;
  href: string;
  primary?: boolean;
  done?: boolean;
}) {
  return (
    <Card className={primary ? 'border-brand-300 dark:border-brand-500/40' : undefined}>
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <Icon className="h-5 w-5" />
          </span>
          {done && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckIcon className="h-3 w-3" /> Done
            </span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-1 flex-1 text-xs text-slate-500 dark:text-slate-400">{body}</p>
        <Link
          href={href}
          className={
            primary
              ? 'mt-4 inline-flex items-center justify-center rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-600'
              : 'mt-4 inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
          }
        >
          {cta}
        </Link>
      </div>
    </Card>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}
