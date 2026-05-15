import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseDate,
  parseAmount,
  invoiceNumberFromFilename,
  parseInvoicePdf,
  parseInvoicePdfs,
} from '../lib/pdf-import';

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

import { getDocument } from 'pdfjs-dist';

function makeFile(name: string, content = ''): File {
  return new File([content], name, { type: 'application/pdf' });
}

function makePdfMock(lines: string[]) {
  // Each line maps to a "page" with items at different Y positions
  const items = lines.map((str, i) => ({
    str,
    transform: [1, 0, 0, 1, 10, 800 - i * 20],
  }));
  return {
    promise: Promise.resolve({
      numPages: 1,
      getPage: () =>
        Promise.resolve({
          getTextContent: () =>
            Promise.resolve({ items }),
        }),
    }),
  };
}

describe('parseDate', () => {
  it('parses YYYY-MM-DD format correctly', () => {
    expect(parseDate('2025-03-15')).toBe('2025-03-15');
  });

  it('parses D/M/Y format correctly', () => {
    expect(parseDate('15/03/2025')).toBe('2025-03-15');
  });

  it('parses natural language date', () => {
    const result = parseDate('January 15, 2025');
    expect(result).toBe('2025-01-15');
  });

  it('returns empty string for unparseable input', () => {
    expect(parseDate('not-a-date')).toBe('');
    expect(parseDate('')).toBe('');
  });

  it('avoids timezone day-shift with UTC handling', () => {
    // A date like "2025-03-15" should not shift to the previous day due to UTC offset
    const result = parseDate('2025-03-15');
    expect(result).toBe('2025-03-15');
  });
});

describe('parseAmount', () => {
  it('strips currency symbols and parses correctly', () => {
    expect(parseAmount('$1234.56')).toBe(1234.56);
    expect(parseAmount('£500.00')).toBe(500);
    expect(parseAmount('€99.99')).toBe(99.99);
  });

  it('handles comma-separated thousands', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('returns 0 for non-numeric input', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('invoiceNumberFromFilename', () => {
  it('extracts INV-001 pattern', () => {
    expect(invoiceNumberFromFilename('INV-001.pdf')).toBe('INV-001');
  });

  it('extracts INV001 pattern (no separator)', () => {
    expect(invoiceNumberFromFilename('INV001.pdf')).toBe('INV001');
  });

  it('extracts trailing numeric segment', () => {
    expect(invoiceNumberFromFilename('invoice-2024.pdf')).toBe('2024');
  });

  it('returns base filename when no pattern matches', () => {
    expect(invoiceNumberFromFilename('myinvoice.pdf')).toBe('myinvoice');
  });
});

describe('parseInvoicePdf', () => {
  beforeEach(() => {
    vi.mocked(getDocument).mockReset();
  });

  it('returns high confidence when 3+ fields extracted', async () => {
    vi.mocked(getDocument).mockReturnValue(
      makePdfMock([
        'Invoice #: 42',
        'Invoice date: January 15, 2025',
        'Bill To',
        'Acme Corp',
        'Grand total  £6124.00',
      ]) as any
    );

    const file = makeFile('invoice-42.pdf');
    const result = await parseInvoicePdf(file);

    expect(result.confidence).toBe('high');
    expect(result.invoiceNumber).toBe('42');
    expect(result.amount).toBe(6124);
    expect(result.issueDate).toBe('2025-01-15');
    expect(result.clientName).toBe('Acme Corp');
  });

  it('returns low confidence when no fields extracted', async () => {
    vi.mocked(getDocument).mockReturnValue(
      makePdfMock(['Some random text', 'with no invoice data']) as any
    );

    const file = makeFile('INV-007.pdf');
    const result = await parseInvoicePdf(file);

    expect(result.confidence).toBe('low');
    expect(result.invoiceNumber).toBe('INV-007'); // fallback to filename
  });

  it('falls back to filename for invoice number when PDF has no invoice number', async () => {
    vi.mocked(getDocument).mockReturnValue(
      makePdfMock(['No invoice number here']) as any
    );

    const file = makeFile('INV-099.pdf');
    const result = await parseInvoicePdf(file);

    expect(result.invoiceNumber).toBe('INV-099');
  });

  it('falls back to filename when extraction fails', async () => {
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.reject(new Error('PDF load error')),
    } as any);

    const file = makeFile('INV-123.pdf');
    const result = await parseInvoicePdf(file);

    expect(result.invoiceNumber).toBe('INV-123');
    expect(result.confidence).toBe('low');
  });
});

describe('parseInvoicePdfs', () => {
  beforeEach(() => {
    vi.mocked(getDocument).mockReset();
  });

  it('processes multiple files in parallel', async () => {
    vi.mocked(getDocument).mockReturnValue(
      makePdfMock(['No invoice data']) as any
    );

    const files = [makeFile('INV-001.pdf'), makeFile('INV-002.pdf'), makeFile('INV-003.pdf')];
    const results = await parseInvoicePdfs(files);

    expect(results).toHaveLength(3);
    expect(results[0].fileName).toBe('INV-001.pdf');
    expect(results[1].fileName).toBe('INV-002.pdf');
    expect(results[2].fileName).toBe('INV-003.pdf');
  });
});
