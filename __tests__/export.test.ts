import { describe, it, expect } from 'vitest';
import { exportTransactionsCSV, exportInvoicesCSV, exportPnLCSV, exportTaxSummaryCSV } from '../lib/export';
import { defaultSettings } from '../lib/defaults';
import type { Transaction, TrackedInvoice, MonthlySummary } from '../lib/types';
import { calculateUKTax } from '../lib/tax';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    date: '2024-06-15',
    type: 'income',
    amount: 1000,
    description: 'Test income',
    category: 'Consulting',
    clientId: null,
    invoiceId: null,
    projectId: null,
    notes: '',
    vatRate: null,
    vatAmount: 0,
    taxDeductible: true,
    attachments: [],
    currency: null,
    exchangeRate: null,
    originalAmount: null,
    recurrence: null,
    reconciliationStatus: 'unreconciled',
    importedFrom: null,
    ...overrides,
  };
}

describe('exportTransactionsCSV', () => {
  it('includes UTF-8 BOM', () => {
    const csv = exportTransactionsCSV([makeTx()], defaultSettings);
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('has correct headers without VAT', () => {
    const csv = exportTransactionsCSV([makeTx()], defaultSettings);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Date');
    expect(lines[0]).toContain('Amount');
    expect(lines[0]).not.toContain('VAT Rate');
  });

  it('has VAT columns when VAT registered', () => {
    const settings = { ...defaultSettings, vatRegistered: true };
    const csv = exportTransactionsCSV([makeTx()], settings);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('VAT Rate');
    expect(lines[0]).toContain('VAT Amount');
  });

  it('formats amounts as numbers without currency symbols', () => {
    const csv = exportTransactionsCSV([makeTx({ amount: 1234.56 })], defaultSettings);
    expect(csv).toContain('1234.56');
    expect(csv).not.toContain('$');
    expect(csv).not.toContain('£');
  });

  it('uses ISO date format', () => {
    const csv = exportTransactionsCSV([makeTx({ date: '2024-06-15' })], defaultSettings);
    expect(csv).toContain('2024-06-15');
  });

  it('escapes commas in fields', () => {
    const csv = exportTransactionsCSV([makeTx({ description: 'Test, with comma' })], defaultSettings);
    expect(csv).toContain('"Test, with comma"');
  });

  it('shows tax deductible status', () => {
    const csv = exportTransactionsCSV([makeTx({ taxDeductible: false })], defaultSettings);
    expect(csv).toContain('No');
  });
});

describe('exportInvoicesCSV', () => {
  it('exports invoices correctly', () => {
    const invoices: TrackedInvoice[] = [{
      id: '1',
      invoiceNumber: 'INV-001',
      clientId: null,
      clientName: 'Client A',
      issueDate: '2024-06-01',
      dueDate: '2024-07-01',
      amount: 5000,
      status: 'paid',
      paidDate: '2024-06-25',
      notes: 'Test',
    }];

    const csv = exportInvoicesCSV(invoices);
    expect(csv).toContain('INV-001');
    expect(csv).toContain('Client A');
    expect(csv).toContain('5000.00');
    expect(csv).toContain('paid');
  });
});

describe('exportPnLCSV', () => {
  it('includes totals row', () => {
    const months: MonthlySummary[] = [
      { month: '2024-04', income: 5000, costs: 2000, net: 3000 },
      { month: '2024-05', income: 6000, costs: 1000, net: 5000 },
    ];
    const csv = exportPnLCSV(months, '2024/25');
    expect(csv).toContain('Total');
    expect(csv).toContain('11000.00');
    expect(csv).toContain('3000.00');
  });
});

describe('exportTaxSummaryCSV', () => {
  it('includes tax breakdown items', () => {
    const tax = calculateUKTax(40000, { year: 2024 });
    const csv = exportTaxSummaryCSV(tax, '2024/25');
    expect(csv).toContain('Income Tax');
    expect(csv).toContain('Total Tax & NI');
    expect(csv).toContain('After Tax');
  });
});
