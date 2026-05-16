'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader, StatCard } from '@/components/Card';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Asset } from '@/lib/types';

function calculateDepreciation(asset: Asset, asOfDate: string): number {
  const start = new Date(asset.purchaseDate);
  const end = asset.disposedDate ? new Date(asset.disposedDate) : new Date(asOfDate);
  const yearsOwned = Math.min(
    (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    asset.usefulLifeYears
  );
  const annualDepreciation = asset.purchaseValue / asset.usefulLifeYears;
  return Math.min(annualDepreciation * yearsOwned, asset.purchaseValue);
}

function getNetBookValue(asset: Asset, asOfDate: string): number {
  if (asset.disposedDate) return asset.disposalValue || 0;
  return asset.purchaseValue - calculateDepreciation(asset, asOfDate);
}

export default function BalanceSheetPage() {
  const { settings, assets, liabilities, transactions } = useApp();
  const sym = settings.currencySymbol || '£';
  const today = new Date().toISOString().split('T')[0];

  const assetSummary = useMemo(() => {
    const activeAssets = assets.filter((a) => !a.disposedDate);
    const totalCost = activeAssets.reduce((s, a) => s + a.purchaseValue, 0);
    const totalDepreciation = activeAssets.reduce((s, a) => s + calculateDepreciation(a, today), 0);
    const totalNBV = activeAssets.reduce((s, a) => s + getNetBookValue(a, today), 0);

    const byCategory: Record<string, { cost: number; nbv: number }> = {};
    for (const a of activeAssets) {
      if (!byCategory[a.category]) byCategory[a.category] = { cost: 0, nbv: 0 };
      byCategory[a.category].cost += a.purchaseValue;
      byCategory[a.category].nbv += getNetBookValue(a, today);
    }

    return { activeAssets, totalCost, totalDepreciation, totalNBV, byCategory };
  }, [assets, today]);

  const liabilitySummary = useMemo(() => {
    const totalBalance = liabilities.reduce((s, l) => s + l.balance, 0);
    const byCategory: Record<string, number> = {};
    for (const l of liabilities) {
      byCategory[l.category] = (byCategory[l.category] || 0) + l.balance;
    }
    return { totalBalance, byCategory };
  }, [liabilities]);

  const cashBalance = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const costs = transactions.filter((t) => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
    return income - costs;
  }, [transactions]);

  const netWorth = cashBalance + assetSummary.totalNBV - liabilitySummary.totalBalance;

  return (
    <>
      <PageHeader title="Balance Sheet" description="Simplified statement of assets and liabilities" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Cash Position" value={formatCurrency(cashBalance, sym)} color={cashBalance >= 0 ? 'green' : 'red'} />
        <StatCard label="Fixed Assets (NBV)" value={formatCurrency(assetSummary.totalNBV, sym)} color="blue" />
        <StatCard label="Liabilities" value={formatCurrency(liabilitySummary.totalBalance, sym)} color="red" />
        <StatCard label="Net Worth" value={formatCurrency(netWorth, sym)} color={netWorth >= 0 ? 'green' : 'red'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Assets</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium border-b border-slate-200 pb-2 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">Cash (net trading position)</span>
              <span className="text-slate-900 dark:text-slate-100">{formatCurrency(cashBalance, sym)}</span>
            </div>
            {Object.entries(assetSummary.byCategory).map(([cat, data]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{cat}</span>
                <span className="text-slate-900 dark:text-slate-100">{formatCurrency(data.nbv, sym)}</span>
              </div>
            ))}
            {assets.length > 0 && (
              <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-2 dark:border-slate-700">
                <span>Total Assets</span>
                <span>{formatCurrency(cashBalance + assetSummary.totalNBV, sym)}</span>
              </div>
            )}
          </div>

          {assetSummary.activeAssets.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <h3 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">Fixed Asset Register</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-1">Asset</th>
                      <th className="pb-1 text-right">Cost</th>
                      <th className="pb-1 text-right">Deprec.</th>
                      <th className="pb-1 text-right">NBV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {assetSummary.activeAssets.map((a) => (
                      <tr key={a.id}>
                        <td className="py-1 text-slate-700 dark:text-slate-300">{a.name}</td>
                        <td className="py-1 text-right">{formatCurrency(a.purchaseValue, sym)}</td>
                        <td className="py-1 text-right text-red-500">{formatCurrency(calculateDepreciation(a, today), sym)}</td>
                        <td className="py-1 text-right font-medium">{formatCurrency(getNetBookValue(a, today), sym)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Liabilities</h2>
          {liabilities.length === 0 ? (
            <p className="text-sm text-slate-500">No liabilities recorded</p>
          ) : (
            <div className="space-y-3">
              {liabilities.map((l) => (
                <div key={l.id} className="flex justify-between text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">{l.name}</span>
                    {l.interestRate > 0 && <span className="ml-1 text-xs text-slate-400">({l.interestRate}%)</span>}
                  </div>
                  <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(l.balance, sym)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-2 dark:border-slate-700">
                <span>Total Liabilities</span>
                <span className="text-red-600">{formatCurrency(liabilitySummary.totalBalance, sym)}</span>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-slate-900 dark:text-slate-100">Net Worth (Assets - Liabilities)</span>
              <span className={netWorth >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(netWorth, sym)}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
