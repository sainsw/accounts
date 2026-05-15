import { generateInvoicePdf, formatISODate } from '@sainsw/invoice-pdf';
import type { PdfInput, Settings as PdfSettings } from '@sainsw/invoice-pdf';
import type { TrackedInvoice, Settings, Client } from './types';

export function downloadInvoicePdf(
  invoice: TrackedInvoice,
  settings: Settings,
  client?: Client,
) {
  const clientAddress = client?.address ?? '';
  const monthKey = invoice.issueDate.slice(0, 7);

  const pdfSettings: PdfSettings = {
    businessName: settings.businessName || 'My Business',
    businessAddress: settings.businessAddress || '',
    email: settings.email || '',
    phone: settings.phone || '',
    defaultClientName: '',
    defaultDailyRate: 0,
    currencySymbol: settings.currencySymbol || '$',
    defaultPaymentTerms: 0,
    bankDetails: '',
    headerColor: '#ffffff',
    bodyColor: '#ffffff',
    defaultNotes: '',
    extraReferences: [],
    filenameTemplate: '[businessname]-[issuedate]-[invoicenumber]',
  };

  const pdfInput: PdfInput = {
    settings: pdfSettings,
    invoice: {
      invoiceMonth: monthKey,
      invoiceNumber: invoice.invoiceNumber,
      purchaseOrder: '',
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
