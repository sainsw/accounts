import type { Transaction, VatReturn, Settings } from './types';
import { isInRange } from './utils';

export const VAT_RATES = [
  { label: 'Standard (20%)', value: 20 },
  { label: 'Reduced (5%)', value: 5 },
  { label: 'Zero-rated (0%)', value: 0 },
  { label: 'Exempt / Outside scope', value: null },
] as const;

export function calculateVatAmount(amount: number, vatRate: number | null, inclusive: boolean = false): number {
  if (vatRate === null || vatRate === 0) return 0;
  if (inclusive) {
    return amount - (amount / (1 + vatRate / 100));
  }
  return amount * (vatRate / 100);
}

export function getNetAmount(amount: number, vatRate: number | null, inclusive: boolean = false): number {
  if (vatRate === null || vatRate === 0) return amount;
  if (inclusive) {
    return amount / (1 + vatRate / 100);
  }
  return amount;
}

export function calculateVatReturn(
  transactions: Transaction[],
  periodStart: string,
  periodEnd: string,
  settings: Settings
): VatReturn {
  const periodTx = transactions.filter((t) => isInRange(t.date, periodStart, periodEnd));

  if (settings.vatScheme === 'flat-rate') {
    const grossTurnover = periodTx
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount + (t.vatAmount || 0), 0);
    const vatDue = grossTurnover * (settings.vatFlatRate / 100);
    const totalSales = periodTx
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const totalPurchases = periodTx
      .filter((t) => t.type === 'cost')
      .reduce((s, t) => s + t.amount, 0);

    return {
      box1: Math.round(vatDue * 100) / 100,
      box2: 0,
      box3: Math.round(vatDue * 100) / 100,
      box4: 0,
      box5: Math.round(vatDue * 100) / 100,
      box6: Math.round(totalSales * 100) / 100,
      box7: Math.round(totalPurchases * 100) / 100,
      box8: 0,
      box9: 0,
    };
  }

  const box1 = periodTx
    .filter((t) => t.type === 'income' && t.vatRate !== null)
    .reduce((s, t) => s + (t.vatAmount || 0), 0);

  const box4 = periodTx
    .filter((t) => t.type === 'cost' && t.vatRate !== null)
    .reduce((s, t) => s + (t.vatAmount || 0), 0);

  const box6 = periodTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const box7 = periodTx
    .filter((t) => t.type === 'cost')
    .reduce((s, t) => s + t.amount, 0);

  const box3 = box1;
  const box5 = box3 - box4;

  return {
    box1: Math.round(box1 * 100) / 100,
    box2: 0,
    box3: Math.round(box3 * 100) / 100,
    box4: Math.round(box4 * 100) / 100,
    box5: Math.round(box5 * 100) / 100,
    box6: Math.round(box6 * 100) / 100,
    box7: Math.round(box7 * 100) / 100,
    box8: 0,
    box9: 0,
  };
}
