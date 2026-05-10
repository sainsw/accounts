'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader, StatCard } from '@/components/Card';
import { formatCurrency, formatDate, formatMonth, getYearRange, isInRange, getFinancialYear } from '@/lib/utils';
import { calculateUKTax, calculateFlatTax, getTaxYearLabel } from '@/lib/tax';
import { exportPnLCSV, exportTaxSummaryCSV, exportTransactionsCSV, downloadCsv } from '@/lib/export';
import type { TaxBandResult, TaxBreakdown } from '@/lib/types';

type ViewMode = 'monthly' | 'quarterly';

export default function ReportsPage() {
  const { ready, settings, transactions } = useApp();
  const currentYear = getFinancialYear(new Date().toISOString().split('T')[0], settings.taxYear);
  const [year, setYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [showPriorYear, setShowPriorYear] = useState(false);
  const [showSASummary, setShowSASummary] = useState(false);
  const yearRange = getYearRange(year, settings.taxYear);
  const priorYearRange = getYearRange(year - 1, settings.taxYear);

  const sym = settings.currencySymbol || '$';
  const locale = settings.locale || 'en-US';

  const yearTx = useMemo(
    () => transactions.filter((t) => isInRange(t.date, yearRange.start, yearRange.end)),
    [transactions, yearRange]
  );

  const priorYearTx = useMemo(
    () => transactions.filter((t) => isInRange(t.date, priorYearRange.start, priorYearRange.end)),
    [transactions, priorYearRange]
  );

  const pnl = useMemo(() => {
    const income = yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const allCosts = yearTx.filter((t) => t.type === 'cost');
    const allowableCosts = allCosts.filter((t) => t.taxDeductible !== false).reduce((s, t) => s + t.amount, 0);
    const nonAllowableCosts = allCosts.filter((t) => t.taxDeductible === false).reduce((s, t) => s + t.amount, 0);
    const totalCosts = allowableCosts + nonAllowableCosts;
    const net = income - totalCosts;

    let vatAdjustedIncome = income;
    let vatAdjustedCosts = allowableCosts;
    if (settings.vatRegistered) {
      vatAdjustedIncome = yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      vatAdjustedCosts = allCosts.filter((t) => t.taxDeductible !== false).reduce((s, t) => s + t.amount, 0);
    }

    const taxableProfit = vatAdjustedIncome - vatAdjustedCosts;

    const tax = settings.taxMode === 'uk-sole-trader'
      ? calculateUKTax(taxableProfit, {
          year,
          grossIncome: vatAdjustedIncome,
          allowableCosts: vatAdjustedCosts,
          nonAllowableCosts,
          voluntaryClass2NI: settings.voluntaryClass2NI,
          studentLoanPlan: settings.studentLoanPlan,
        })
      : calculateFlatTax(net, settings.taxRate);

    return { income, costs: totalCosts, allowableCosts, nonAllowableCosts, net, tax };
  }, [yearTx, settings, year]);

  const priorPnl = useMemo(() => {
    if (!showPriorYear) return null;
    const income = priorYearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const costs = priorYearTx.filter((t) => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
    const net = income - costs;
    const tax = settings.taxMode === 'uk-sole-trader'
      ? calculateUKTax(net, { year: year - 1 })
      : calculateFlatTax(net, settings.taxRate);
    return { income, costs, net, tax };
  }, [priorYearTx, showPriorYear, settings, year]);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of yearTx.filter((t) => t.type === 'income')) {
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [yearTx]);

  const costByCategory = useMemo(() => {
    const map: Record<string, { allowable: number; nonAllowable: number }> = {};
    for (const t of yearTx.filter((t) => t.type === 'cost')) {
      if (!map[t.category]) map[t.category] = { allowable: 0, nonAllowable: 0 };
      if (t.taxDeductible === false) map[t.category].nonAllowable += t.amount;
      else map[t.category].allowable += t.amount;
    }
    return Object.entries(map).sort(([, a], [, b]) => (b.allowable + b.nonAllowable) - (a.allowable + a.nonAllowable));
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

  const quarterlyPnl = useMemo(() => {
    const quarters: { label: string; income: number; costs: number; net: number; cumulative: number }[] = [];
    const qMonths = settings.taxYear === 'apr-mar'
      ? [[4, 5, 6], [7, 8, 9], [10, 11, 12], [1, 2, 3]]
      : [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];

    let cumulative = 0;
    qMonths.forEach((months, i) => {
      const qTx = yearTx.filter((t) => {
        const m = parseInt(t.date.slice(5, 7));
        return months.includes(m);
      });
      const income = qTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const costs = qTx.filter((t) => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
      const net = income - costs;
      cumulative += net;
      quarters.push({
        label: `Q${i + 1} (${monthName(months[0])}–${monthName(months[2])})`,
        income,
        costs,
        net,
        cumulative,
      });
    });
    return quarters;
  }, [yearTx, settings.taxYear]);

  if (!ready) return null;

  const yearLabel = settings.taxYear !== 'calendar'
    ? `${year}/${String(year + 1).slice(2)}`
    : `${year}`;

  const priorYearLabel = settings.taxYear !== 'calendar'
    ? `${year - 1}/${String(year).slice(2)}`
    : `${year - 1}`;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Financial year ${yearLabel}${settings.taxMode === 'uk-sole-trader' ? ` · Basis: ${settings.accountingBasis === 'cash' ? 'Cash' : 'Accruals'}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => {
                  const menu = document.getElementById('export-menu');
                  if (menu) menu.classList.toggle('hidden');
                }}>
                Export ▾
              </button>
              <div id="export-menu" className="hidden absolute right-0 top-full mt-1 z-10 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <button className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => {
                  downloadCsv(exportPnLCSV(monthlyPnl, yearLabel), `pnl-${yearLabel}.csv`);
                }}>P&L as CSV</button>
                <button className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => {
                  downloadCsv(exportTaxSummaryCSV(pnl.tax, yearLabel), `tax-summary-${yearLabel}.csv`);
                }}>Tax summary as CSV</button>
                <button className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => {
                  downloadCsv(exportTransactionsCSV(yearTx, settings), `transactions-${yearLabel}.csv`);
                }}>Full year transactions CSV</button>
              </div>
            </div>
            <button onClick={() => setYear((y) => y - 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">&larr;</button>
            <span className="min-w-[4rem] text-center text-sm font-medium">{yearLabel}</span>
            <button onClick={() => setYear((y) => y + 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">&rarr;</button>
          </div>
        }
      />

      {/* Rates fallback warning */}
      {pnl.tax.ratesFallback && settings.taxMode === 'uk-sole-trader' && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Tax rates for {pnl.tax.taxYear} are not yet available — showing estimate using {pnl.tax.ratesYear} rates
        </div>
      )}

      {/* P&L Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Income" value={formatCurrency(pnl.income, sym)} color="green" />
        <StatCard label="Total Costs" value={formatCurrency(pnl.costs, sym)} color="red"
          sub={pnl.nonAllowableCosts > 0 ? `${formatCurrency(pnl.allowableCosts, sym)} allowable` : undefined} />
        <StatCard label="Net Profit" value={formatCurrency(pnl.net, sym)} color={pnl.net >= 0 ? 'green' : 'red'} />
        <StatCard label="Est. Tax" value={formatCurrency(pnl.tax.totalTax, sym)} color="red" />
        <StatCard label="After Tax" value={formatCurrency(pnl.tax.afterTax, sym)} color={pnl.tax.afterTax >= 0 ? 'green' : 'red'} />
      </div>

      {/* View mode + comparison toggles */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600">
          {(['monthly', 'quarterly'] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-3 py-1 text-xs font-medium capitalize first:rounded-l-lg last:rounded-r-lg ${viewMode === m ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400'}`}>
              {m}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showPriorYear} onChange={(e) => setShowPriorYear(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500" />
          Compare with {priorYearLabel}
        </label>
        {settings.taxMode === 'uk-sole-trader' && (
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={showSASummary} onChange={(e) => setShowSASummary(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500" />
            Self-Assessment Helper
          </label>
        )}
      </div>

      {/* Tax Breakdown */}
      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Tax Breakdown
          <span className="ml-2 text-xs font-normal text-slate-500">
            {settings.taxMode === 'uk-sole-trader' ? `UK Sole Trader (${pnl.tax.ratesYear})` : `Flat rate ${settings.taxRate}%`}
          </span>
        </h2>
        {pnl.net <= 0 ? (
          <p className="text-sm text-slate-500">No taxable profit this period</p>
        ) : (
          <div className="space-y-4">
            {/* Allowable vs non-allowable cost split */}
            {pnl.nonAllowableCosts > 0 && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
                <div className="flex justify-between"><span>Gross Income</span><span>{formatCurrency(pnl.income, sym)}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Allowable Costs</span><span>-{formatCurrency(pnl.allowableCosts, sym)}</span></div>
                <div className="flex justify-between text-orange-600"><span>Non-allowable Costs</span><span>-{formatCurrency(pnl.nonAllowableCosts, sym)} (not deducted)</span></div>
                <div className="mt-1 flex justify-between font-semibold border-t border-slate-200 pt-1 dark:border-slate-700">
                  <span>Taxable Profit</span><span>{formatCurrency(pnl.tax.grossProfit, sym)}</span>
                </div>
              </div>
            )}

            {pnl.tax.tradingAllowanceUsed && (
              <div className="rounded-lg bg-blue-50 p-2 text-xs text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                Trading allowance applied — using £1,000 allowance instead of actual expenses
              </div>
            )}

            <TaxBandsTable title="Income Tax" bands={pnl.tax.incomeTaxBands} total={pnl.tax.incomeTax} sym={sym} />
            {settings.taxMode === 'uk-sole-trader' && (
              <>
                <TaxBandsTable title="Class 4 National Insurance" bands={pnl.tax.class4NIBands} total={pnl.tax.class4NI} sym={sym} />
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">
                    Class 2 National Insurance
                    <span className="ml-1 text-xs text-slate-400">
                      {pnl.tax.class2NIVoluntary ? '(voluntary)' : '(flat weekly rate)'}
                    </span>
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(pnl.tax.class2NI, sym)}</span>
                </div>
                {pnl.tax.studentLoanRepayment > 0 && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">
                      Student Loan Repayment
                      <span className="ml-1 text-xs text-slate-400">({pnl.tax.studentLoanPlan})</span>
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(pnl.tax.studentLoanRepayment, sym)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Total Tax & NI</span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(pnl.tax.totalTax, sym)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Take-Home Profit</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(pnl.tax.afterTax, sym)}</span>
            </div>

            {settings.vatRegistered && (
              <p className="text-xs text-slate-400 italic">Figures shown net of VAT</p>
            )}
          </div>
        )}
      </Card>

      {/* Payments on Account */}
      {settings.taxMode === 'uk-sole-trader' && pnl.net > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Payment Schedule</h2>
          {pnl.tax.paymentsOnAccount.applies ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">1st Payment on Account — {formatDate(pnl.tax.paymentsOnAccount.firstPaymentDate, locale)}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(pnl.tax.paymentsOnAccount.firstPayment, sym)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">2nd Payment on Account — {formatDate(pnl.tax.paymentsOnAccount.secondPaymentDate, locale)}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(pnl.tax.paymentsOnAccount.secondPayment, sym)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-200 pt-2 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Balancing payment (when actual figures known)</span>
                <span className="text-xs text-slate-400">TBD</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Payments on account are based on your previous year&apos;s tax bill. These estimates assume your income is similar year-on-year.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No payments on account required (tax bill under £1,000)</p>
          )}
        </Card>
      )}

      {/* Self-Assessment Summary */}
      {showSASummary && settings.taxMode === 'uk-sole-trader' && (
        <SelfAssessmentSummary pnl={pnl} tax={pnl.tax} sym={sym} />
      )}

      {/* Prior year comparison */}
      {showPriorYear && priorPnl && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Year-over-Year Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-700">
                  <th className="pb-2">Metric</th>
                  <th className="pb-2 text-right">{yearLabel}</th>
                  <th className="pb-2 text-right">{priorYearLabel}</th>
                  <th className="pb-2 text-right">Variance</th>
                  <th className="pb-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {[
                  { label: 'Income', current: pnl.income, prior: priorPnl.income },
                  { label: 'Costs', current: pnl.costs, prior: priorPnl.costs },
                  { label: 'Net Profit', current: pnl.net, prior: priorPnl.net },
                  { label: 'Est. Tax', current: pnl.tax.totalTax, prior: priorPnl.tax.totalTax },
                  { label: 'After Tax', current: pnl.tax.afterTax, prior: priorPnl.tax.afterTax },
                ].map((row) => {
                  const variance = row.current - row.prior;
                  const pct = row.prior !== 0 ? (variance / row.prior) * 100 : 0;
                  return (
                    <tr key={row.label}>
                      <td className="py-2 text-slate-600 dark:text-slate-400">{row.label}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(row.current, sym)}</td>
                      <td className="py-2 text-right text-slate-500">{formatCurrency(row.prior, sym)}</td>
                      <td className={`py-2 text-right font-medium ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {variance >= 0 ? '+' : ''}{formatCurrency(variance, sym)}
                      </td>
                      <td className={`py-2 text-right text-xs ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {row.prior !== 0 ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(amt / pnl.income) * 100}%` }} />
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
              {costByCategory.map(([cat, data]) => {
                const total = data.allowable + data.nonAllowable;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        {cat}
                        {data.nonAllowable > 0 && (
                          <span className="ml-1 text-orange-500">({formatCurrency(data.nonAllowable, sym)} non-allowable)</span>
                        )}
                      </span>
                      <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(total, sym)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                      <div className="h-2 rounded-full bg-red-400" style={{ width: `${(total / pnl.costs) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Monthly / Quarterly P&L Table */}
      <Card className="mt-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {viewMode === 'monthly' ? 'Monthly' : 'Quarterly'} Profit & Loss
        </h2>
        {viewMode === 'monthly' ? (
          monthlyPnl.length === 0 ? (
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
                      <td className="py-2 text-slate-600 dark:text-slate-400">{formatMonth(m.month + '-01', locale)}</td>
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
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-700">
                  <th className="pb-2">Quarter</th>
                  <th className="pb-2 text-right">Income</th>
                  <th className="pb-2 text-right">Costs</th>
                  <th className="pb-2 text-right">Net</th>
                  <th className="pb-2 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {quarterlyPnl.map((q, i) => {
                  const isCurrentQuarter = isCurrentQ(i, settings.taxYear);
                  return (
                    <tr key={q.label} className={isCurrentQuarter ? 'bg-brand-50/50 dark:bg-brand-500/5' : ''}>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        {q.label}
                        {isCurrentQuarter && <span className="ml-1 text-[10px] text-brand-500 font-medium">current</span>}
                      </td>
                      <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(q.income, sym)}</td>
                      <td className="py-2 text-right text-red-600 dark:text-red-400">{formatCurrency(q.costs, sym)}</td>
                      <td className={`py-2 text-right font-semibold ${q.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(q.net, sym)}
                      </td>
                      <td className={`py-2 text-right text-xs ${q.cumulative >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(q.cumulative, sym)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function SelfAssessmentSummary({ pnl, tax, sym }: { pnl: { income: number; allowableCosts: number; net: number }; tax: TaxBreakdown; sym: string }) {
  return (
    <Card className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Self-Assessment Helper</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">SA103 — Self-Employment</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                <tr><td className="py-1.5 text-slate-500">Box 15</td><td className="py-1.5">Turnover</td><td className="py-1.5 text-right font-medium">{formatCurrency(pnl.income, sym)}</td></tr>
                <tr><td className="py-1.5 text-slate-500">Box 24</td><td className="py-1.5">Allowable expenses</td><td className="py-1.5 text-right font-medium">{formatCurrency(pnl.allowableCosts, sym)}</td></tr>
                <tr><td className="py-1.5 text-slate-500">Box 26</td><td className="py-1.5">Net profit</td><td className="py-1.5 text-right font-medium">{formatCurrency(tax.grossProfit, sym)}</td></tr>
                <tr><td className="py-1.5 text-slate-500">Box 29</td><td className="py-1.5">Total taxable profits</td><td className="py-1.5 text-right font-medium">{formatCurrency(tax.grossProfit, sym)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">SA100 — Main Return</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                <tr><td className="py-1.5" colSpan={2}>Total income</td><td className="py-1.5 text-right font-medium">{formatCurrency(tax.grossProfit, sym)}</td></tr>
                <tr><td className="py-1.5" colSpan={2}>Personal allowance</td><td className="py-1.5 text-right font-medium">{formatCurrency(tax.incomeTaxBands[0]?.to ?? 12570, sym)}</td></tr>
                <tr><td className="py-1.5" colSpan={2}>Taxable income</td><td className="py-1.5 text-right font-medium">{formatCurrency(Math.max(0, tax.grossProfit - (tax.incomeTaxBands[0]?.to ?? 12570)), sym)}</td></tr>
                <tr><td className="py-1.5" colSpan={2}>Income tax due</td><td className="py-1.5 text-right font-medium">{formatCurrency(tax.incomeTax, sym)}</td></tr>
                <tr><td className="py-1.5" colSpan={2}>Class 4 NI due</td><td className="py-1.5 text-right font-medium">{formatCurrency(tax.class4NI, sym)}</td></tr>
                <tr><td className="py-1.5" colSpan={2}>Class 2 NI due</td><td className="py-1.5 text-right font-medium">{formatCurrency(tax.class2NI, sym)}</td></tr>
                {tax.studentLoanRepayment > 0 && (
                  <tr><td className="py-1.5" colSpan={2}>Student loan</td><td className="py-1.5 text-right font-medium">{formatCurrency(tax.studentLoanRepayment, sym)}</td></tr>
                )}
                <tr className="font-semibold"><td className="py-1.5" colSpan={2}>Total due</td><td className="py-1.5 text-right text-red-600">{formatCurrency(tax.totalTax, sym)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
          These figures are estimates. Review with your accountant before filing.
        </p>
      </div>
    </Card>
  );
}

function TaxBandsTable({ title, bands, total, sym }: { title: string; bands: TaxBandResult[]; total: number; sym: string }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-700">
              <th className="pb-1.5">Band</th>
              <th className="pb-1.5 text-right">Rate</th>
              <th className="pb-1.5 text-right">Taxable</th>
              <th className="pb-1.5 text-right">Tax</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {bands.map((band) => (
              <tr key={band.name}>
                <td className="py-1.5 text-slate-600 dark:text-slate-400">
                  {band.name}
                  <span className="ml-1 text-slate-400 dark:text-slate-500">
                    ({formatCurrency(band.from, sym)} – {band.to !== null ? formatCurrency(band.to, sym) : '∞'})
                  </span>
                </td>
                <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{(band.rate * 100).toFixed(0)}%</td>
                <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{formatCurrency(band.taxableAmount, sym)}</td>
                <td className="py-1.5 text-right font-medium text-slate-900 dark:text-slate-100">{formatCurrency(band.tax, sym)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={3} className="pt-2 text-slate-900 dark:text-slate-100">Total {title}</td>
              <td className="pt-2 text-right text-red-600 dark:text-red-400">{formatCurrency(total, sym)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function monthName(m: number): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
}

function isCurrentQ(qIndex: number, taxYear: string): boolean {
  const now = new Date();
  const m = now.getMonth() + 1;
  const qMonths = taxYear === 'apr-mar'
    ? [[4, 5, 6], [7, 8, 9], [10, 11, 12], [1, 2, 3]]
    : [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];
  return qMonths[qIndex]?.includes(m) ?? false;
}
