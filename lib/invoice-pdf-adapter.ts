import { generateInvoicePdf, formatISODate } from '@sainsw/invoice-pdf';
import type { PdfInput, Settings as PdfSettings, Expense as PdfExpense, WorkBlock as PdfWorkBlock } from '@sainsw/invoice-pdf';
import type { TrackedInvoice, Settings, Client } from './types';
import { computeInvoiceTotals } from './invoice-utils';

export function downloadInvoicePdf(
  invoice: TrackedInvoice,
  settings: Settings,
  client?: Client,
) {
  const clientAddress = client?.address ?? '';
  const monthKey = invoice.issueDate.slice(0, 7);
  const inv = settings.invoicing || {};

  const pdfSettings: PdfSettings = {
    businessName: settings.businessName || 'My Business',
    businessAddress: settings.businessAddress || '',
    email: settings.email || '',
    phone: settings.phone || '',
    defaultClientName: '',
    defaultDailyRate: inv.defaultDailyRate ?? 0,
    currencySymbol: settings.currencySymbol || '$',
    defaultPaymentTerms: inv.defaultPaymentTerms ?? 0,
    bankDetails: inv.bankDetails ?? '',
    headerColor: inv.headerColor ?? '#ffffff',
    bodyColor: inv.bodyColor ?? '#ffffff',
    defaultNotes: inv.defaultNotes ?? '',
    extraReferences: inv.extraReferences ?? [],
    filenameTemplate: inv.filenameTemplate ?? '[businessname]-[issuedate]-[invoicenumber]',
  };

  const hasLineItems = (invoice.workBlocks?.length ?? 0) > 0;
  const taxRate = invoice.taxRate || 0;

  if (hasLineItems) {
    const wbs = invoice.workBlocks!;
    const exps = invoice.expenses || [];
    const totals = computeInvoiceTotals(wbs, exps, taxRate);

    const pdfWorkBlocks: PdfWorkBlock[] = wbs.map((wb) => ({
      id: wb.id,
      description: wb.description,
      startDate: wb.startDate,
      endDate: wb.endDate,
      billingMode: wb.billingMode,
      dailyRate: wb.dailyRate,
      blockTotal: wb.blockTotal,
    }));

    const pdfExpenses: PdfExpense[] = exps.map((ex) => ({
      id: ex.id,
      date: ex.date,
      value: ex.amount,
      notes: ex.notes,
    }));

    const pdfInput: PdfInput = {
      settings: pdfSettings,
      invoice: {
        invoiceMonth: monthKey,
        invoiceNumber: invoice.invoiceNumber,
        purchaseOrder: invoice.purchaseOrder || '',
        issueDate: invoice.issueDate || formatISODate(new Date()),
        clientName: invoice.clientName,
        clientAddress,
        remittanceEmail: settings.email || '',
        notes: invoice.notes || '',
        taxRate,
        workBlocks: pdfWorkBlocks,
        expenses: pdfExpenses,
      },
      lineItems: totals.computed,
      totals: {
        workSubtotal: totals.workSubtotal,
        expensesSubtotal: totals.expensesSubtotal,
        preTaxSubtotal: totals.preTaxSubtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
      },
    };
    generateInvoicePdf(pdfInput);
  } else {
    const pdfInput: PdfInput = {
      settings: pdfSettings,
      invoice: {
        invoiceMonth: monthKey,
        invoiceNumber: invoice.invoiceNumber,
        purchaseOrder: invoice.purchaseOrder || '',
        issueDate: invoice.issueDate || formatISODate(new Date()),
        clientName: invoice.clientName,
        clientAddress,
        remittanceEmail: settings.email || '',
        notes: invoice.notes || '',
        taxRate: 0,
        workBlocks: [],
        expenses: [],
      },
      lineItems: [
        {
          id: 'line-1',
          description: `Invoice ${invoice.invoiceNumber}`,
          startDate: invoice.issueDate || formatISODate(new Date()),
          endDate: invoice.dueDate || invoice.issueDate || formatISODate(new Date()),
          billingMode: 'block' as const,
          dailyRate: 0,
          blockTotal: invoice.amount,
          days: 1,
          effectiveDailyRate: invoice.amount,
          lineTotal: invoice.amount,
          hasError: false,
        },
      ],
      totals: {
        workSubtotal: invoice.amount,
        expensesSubtotal: 0,
        preTaxSubtotal: invoice.amount,
        taxAmount: 0,
        total: invoice.amount,
      },
    };
    generateInvoicePdf(pdfInput);
  }
}
