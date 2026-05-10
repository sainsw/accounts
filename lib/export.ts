import type { Transaction, TrackedInvoice, MonthlySummary, TaxBreakdown, Settings } from './types';

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsv).join(',');
}

function buildCsv(headers: string[], rows: string[][]): string {
  const BOM = '﻿';
  const headerLine = toCsvRow(headers);
  const dataLines = rows.map(toCsvRow);
  return BOM + [headerLine, ...dataLines].join('\n');
}

export function exportTransactionsCSV(transactions: Transaction[], settings: Settings): string {
  const vatEnabled = settings.vatRegistered;
  const headers = [
    'Date', 'Type', 'Description', 'Category', 'Amount', 'Client', 'Invoice Number', 'Notes', 'Tax Deductible',
    ...(vatEnabled ? ['VAT Rate', 'VAT Amount'] : []),
  ];

  const rows = transactions.map((t) => [
    t.date,
    t.type,
    t.description,
    t.category,
    t.amount.toFixed(2),
    '',
    '',
    t.notes || '',
    t.taxDeductible === false ? 'No' : 'Yes',
    ...(vatEnabled ? [
      t.vatRate !== null && t.vatRate !== undefined ? `${t.vatRate}%` : 'N/A',
      (t.vatAmount || 0).toFixed(2),
    ] : []),
  ]);

  return buildCsv(headers, rows);
}

export function exportInvoicesCSV(invoices: TrackedInvoice[]): string {
  const headers = ['Invoice Number', 'Client', 'Issue Date', 'Due Date', 'Amount', 'Status', 'Paid Date', 'Notes'];
  const rows = invoices.map((i) => [
    i.invoiceNumber,
    i.clientName,
    i.issueDate,
    i.dueDate || '',
    i.amount.toFixed(2),
    i.status,
    i.paidDate || '',
    i.notes || '',
  ]);
  return buildCsv(headers, rows);
}

export function exportPnLCSV(monthlyPnl: MonthlySummary[], year: string): string {
  const headers = ['Month', 'Income', 'Costs', 'Net Profit'];
  const rows = monthlyPnl.map((m) => [
    m.month,
    m.income.toFixed(2),
    m.costs.toFixed(2),
    m.net.toFixed(2),
  ]);

  const totalIncome = monthlyPnl.reduce((s, m) => s + m.income, 0);
  const totalCosts = monthlyPnl.reduce((s, m) => s + m.costs, 0);
  rows.push(['Total', totalIncome.toFixed(2), totalCosts.toFixed(2), (totalIncome - totalCosts).toFixed(2)]);

  return buildCsv(headers, rows);
}

export function exportTaxSummaryCSV(tax: TaxBreakdown, year: string): string {
  const headers = ['Item', 'Amount'];
  const rows: string[][] = [
    ['Tax Year', year],
    ['Gross Profit', tax.grossProfit.toFixed(2)],
    ['', ''],
    ['--- Income Tax ---', ''],
  ];

  for (const band of tax.incomeTaxBands) {
    rows.push([`${band.name} (${(band.rate * 100).toFixed(0)}%)`, band.tax.toFixed(2)]);
  }
  rows.push(['Total Income Tax', tax.incomeTax.toFixed(2)]);
  rows.push(['', '']);
  rows.push(['--- National Insurance ---', '']);

  if (tax.class4NIBands.length > 0) {
    for (const band of tax.class4NIBands) {
      rows.push([`Class 4 ${band.name} (${(band.rate * 100).toFixed(0)}%)`, band.tax.toFixed(2)]);
    }
  }
  rows.push(['Class 4 NI Total', tax.class4NI.toFixed(2)]);
  rows.push(['Class 2 NI', tax.class2NI.toFixed(2)]);
  rows.push(['Total NI', tax.totalNI.toFixed(2)]);

  if (tax.studentLoanRepayment > 0) {
    rows.push(['', '']);
    rows.push(['Student Loan Repayment', tax.studentLoanRepayment.toFixed(2)]);
  }

  rows.push(['', '']);
  rows.push(['Total Tax & NI', tax.totalTax.toFixed(2)]);
  rows.push(['After Tax', tax.afterTax.toFixed(2)]);

  return buildCsv(headers, rows);
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
