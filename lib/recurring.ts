import type { Transaction, TrackedInvoice, Recurrence } from './types';

function addInterval(date: string, frequency: Recurrence['frequency']): string {
  const d = new Date(date + 'T00:00:00');
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().split('T')[0];
}

export function getNextOccurrenceDate(recurrence: Recurrence): string | null {
  if (!recurrence.active) return null;
  const lastDate = recurrence.lastGenerated || recurrence.startDate;
  const next = addInterval(lastDate, recurrence.frequency);
  if (recurrence.endDate && next > recurrence.endDate) return null;
  return next;
}

export function getDueRecurringTransactions(
  transactions: Transaction[],
  today: string
): { template: Transaction; nextDate: string }[] {
  const due: { template: Transaction; nextDate: string }[] = [];

  for (const t of transactions) {
    if (!t.recurrence || !t.recurrence.active) continue;
    const nextDate = getNextOccurrenceDate(t.recurrence);
    if (nextDate && nextDate <= today) {
      due.push({ template: t, nextDate });
    }
  }

  return due;
}

export function generateFromRecurring(template: Transaction, date: string): Omit<Transaction, 'id'> {
  const { id: _, ...rest } = template;
  return {
    ...rest,
    date,
    recurrence: null,
    reconciliationStatus: 'unreconciled',
    notes: template.notes ? `${template.notes} (recurring)` : '(recurring)',
  };
}

export function getDueRecurringInvoices(
  invoices: TrackedInvoice[],
  today: string
): { template: TrackedInvoice; nextDate: string }[] {
  const due: { template: TrackedInvoice; nextDate: string }[] = [];

  for (const inv of invoices) {
    if (!inv.recurrence || !inv.recurrence.active) continue;
    const nextDate = getNextOccurrenceDate(inv.recurrence);
    if (nextDate && nextDate <= today) {
      due.push({ template: inv, nextDate });
    }
  }

  return due;
}

export function incrementInvoiceNumber(current: string): string {
  const match = current.match(/^(.*?)(\d+)$/);
  if (!match) return current + '-2';
  const prefix = match[1];
  const num = parseInt(match[2], 10) + 1;
  const padded = String(num).padStart(match[2].length, '0');
  return prefix + padded;
}
