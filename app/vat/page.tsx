'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader, StatCard } from '@/components/Card';
import { formatCurrency, getYearRange, isInRange } from '@/lib/utils';
import { calculateVatReturn } from '@/lib/vat';
import type { VatReturn } from '@/lib/types';

const QUARTER_MONTHS = [
  { label: 'Q1 (Apr–Jun)', start: '04', end: '06' },
  { label: 'Q2 (Jul–Sep)', start: '07', end: '09' },
  { label: 'Q3 (Oct–Dec)', start: '10', end: '12' },
  { label: 'Q4 (Jan–Mar)', start: '01', end: '03' },
];

export default function VatPage() {
  const { ready, settings, transactions } = useApp();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(0);

  const sym = settings.currencySymbol || '$';

  const quarterRange = useMemo(() => {
    const q = QUARTER_MONTHS[quarter];
    const qYear = quarter === 3 ? year + 1 : year;
    const lastDay = new Date(parseInt(`${qYear}`), parseInt(q.end), 0).getDate();
    return {
      start: `${qYear}-${q.start}-01`,
      end: `${qYear}-${q.end}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [year, quarter]);

  const vatReturn = useMemo(
    () => calculateVatReturn(transactions, quarterRange.start, quarterRange.end, settings),
    [transactions, quarterRange, settings]
  );

  if (!ready) return null;

  if (!settings.vatRegistered) {
    return (
      <>
        <PageHeader title="VAT" description="VAT is not enabled" />
        <Card>
          <p className="text-sm text-slate-500">
            Enable VAT in Settings to track VAT on your transactions and generate quarterly VAT return summaries.
          </p>
        </Card>
      </>
    );
  }

  const yearLabel = `${year}/${String(year + 1).slice(2)}`;

  return (
    <>
      <PageHeader
        title="VAT Return"
        description={`${QUARTER_MONTHS[quarter].label} — ${yearLabel} · ${settings.vatScheme === 'flat-rate' ? 'Flat Rate Scheme' : settings.vatScheme === 'cash-accounting' ? 'Cash Accounting' : 'Standard Scheme'}`}
        actions={
          <div className="flex items-center gap-2">
            <select value={quarter} onChange={(e) => setQuarter(parseInt(e.target.value))}
              className="rounded-lg border border-slate-300 bg-transparent px-3 py-1 text-sm dark:border-slate-600">
              {QUARTER_MONTHS.map((q, i) => (
                <option key={i} value={i}>{q.label}</option>
              ))}
            </select>
            <button onClick={() => setYear((y) => y - 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">&larr;</button>
            <span className="min-w-[4rem] text-center text-sm font-medium">{yearLabel}</span>
            <button onClick={() => setYear((y) => y + 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">&rarr;</button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="VAT Due on Sales" value={formatCurrency(vatReturn.box1, sym)} color="red" />
        <StatCard label="VAT Reclaimed" value={formatCurrency(vatReturn.box4, sym)} color="green" />
        <StatCard
          label={vatReturn.box5 >= 0 ? 'Net VAT to Pay' : 'Net VAT to Reclaim'}
          value={formatCurrency(Math.abs(vatReturn.box5), sym)}
          color={vatReturn.box5 >= 0 ? 'red' : 'green'}
        />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">VAT Return Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-700">
                <th className="pb-2">Box</th>
                <th className="pb-2">Description</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {[
                { box: '1', desc: 'VAT due on sales and other outputs', value: vatReturn.box1 },
                { box: '2', desc: 'VAT due on acquisitions from EU', value: vatReturn.box2 },
                { box: '3', desc: 'Total VAT due (Box 1 + Box 2)', value: vatReturn.box3 },
                { box: '4', desc: 'VAT reclaimed on purchases and other inputs', value: vatReturn.box4 },
                { box: '5', desc: 'Net VAT to pay/reclaim (Box 3 - Box 4)', value: vatReturn.box5 },
                { box: '6', desc: 'Total value of sales excluding VAT', value: vatReturn.box6 },
                { box: '7', desc: 'Total value of purchases excluding VAT', value: vatReturn.box7 },
                { box: '8', desc: 'Total value of supplies to EU (ex. VAT)', value: vatReturn.box8 },
                { box: '9', desc: 'Total value of acquisitions from EU (ex. VAT)', value: vatReturn.box9 },
              ].map((row) => (
                <tr key={row.box} className={row.box === '5' ? 'bg-slate-50 dark:bg-slate-800 font-semibold' : ''}>
                  <td className="py-2 text-slate-500 dark:text-slate-400">Box {row.box}</td>
                  <td className="py-2 text-slate-600 dark:text-slate-400">{row.desc}</td>
                  <td className="py-2 text-right font-medium text-slate-900 dark:text-slate-100">{formatCurrency(row.value, sym)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {settings.vatScheme === 'flat-rate' && (
          <p className="mt-3 text-xs text-slate-400">
            Flat Rate Scheme: VAT calculated at {settings.vatFlatRate}% of gross turnover (including VAT).
            VAT on purchases is not reclaimed under this scheme.
          </p>
        )}
      </Card>
    </>
  );
}
