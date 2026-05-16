import type { InvoiceWorkBlock, InvoiceExpense } from './types';
import { countWeekdaysInclusive } from '@sainsw/invoice-pdf';
import type { ComputedWorkBlock } from '@sainsw/invoice-pdf';

export function computeWorkBlock(wb: InvoiceWorkBlock): ComputedWorkBlock {
  const days = countWeekdaysInclusive(wb.startDate, wb.endDate);
  const lineTotal = wb.billingMode === 'daily' ? days * wb.dailyRate : wb.blockTotal;
  const effectiveDailyRate = days > 0 ? lineTotal / days : 0;
  return {
    ...wb,
    days,
    effectiveDailyRate,
    lineTotal,
    hasError: days <= 0 || lineTotal <= 0,
  };
}

export function computeInvoiceTotals(
  workBlocks: InvoiceWorkBlock[],
  expenses: InvoiceExpense[],
  taxRate: number,
) {
  const computed = workBlocks.map(computeWorkBlock);
  const workSubtotal = computed.reduce((s, b) => s + b.lineTotal, 0);
  const expensesSubtotal = expenses.reduce((s, e) => s + e.amount, 0);
  const preTaxSubtotal = workSubtotal + expensesSubtotal;
  const taxAmount = preTaxSubtotal * (taxRate / 100);
  const total = preTaxSubtotal + taxAmount;
  return { workSubtotal, expensesSubtotal, preTaxSubtotal, taxAmount, total, computed };
}
