import type { Transaction } from './types';

export type ImportPreset = {
  name: string;
  columns: Record<string, string>;
  dateFormat: string;
  amountHandling: 'single' | 'split';
};

export const COMPETITOR_PRESETS: Record<string, ImportPreset> = {
  freeagent: {
    name: 'FreeAgent',
    columns: {
      date: 'Dated on',
      description: 'Description',
      amount: 'Gross Value',
      category: 'Category',
      type: 'Type',
    },
    dateFormat: 'DD/MM/YYYY',
    amountHandling: 'single',
  },
  xero: {
    name: 'Xero',
    columns: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Account',
      type: 'Type',
    },
    dateFormat: 'DD MMM YYYY',
    amountHandling: 'single',
  },
  quickbooks: {
    name: 'QuickBooks',
    columns: {
      date: 'Date',
      description: 'Memo/Description',
      amount: 'Amount',
      category: 'Category',
      type: 'Transaction Type',
    },
    dateFormat: 'MM/DD/YYYY',
    amountHandling: 'single',
  },
  generic: {
    name: 'Generic CSV',
    columns: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category',
      type: 'Type',
    },
    dateFormat: 'YYYY-MM-DD',
    amountHandling: 'single',
  },
};

function parseDate(value: string, format: string): string {
  const cleaned = value.trim().replace(/"/g, '');
  if (format === 'DD/MM/YYYY') {
    const [d, m, y] = cleaned.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (format === 'MM/DD/YYYY') {
    const [m, d, y] = cleaned.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (format === 'YYYY-MM-DD') return cleaned;
  if (format === 'DD MMM YYYY') {
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const parts = cleaned.split(' ');
    return `${parts[2]}-${months[parts[1]] || '01'}-${parts[0].padStart(2, '0')}`;
  }
  return cleaned;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(cell.trim());
        cell = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        current.push(cell.trim());
        if (current.some((c) => c !== '')) rows.push(current);
        current = [];
        cell = '';
        if (ch === '\r') i++;
      } else {
        cell += ch;
      }
    }
  }
  if (cell || current.length > 0) {
    current.push(cell.trim());
    if (current.some((c) => c !== '')) rows.push(current);
  }
  return rows;
}

export type ImportResult = {
  transactions: Omit<Transaction, 'id'>[];
  errors: { row: number; message: string }[];
  skipped: number;
};

export function importFromCSV(
  csvText: string,
  columnMapping: Record<string, number>,
  dateFormat: string,
  existingTransactions: Transaction[]
): ImportResult {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return { transactions: [], errors: [], skipped: 0 };

  const result: ImportResult = { transactions: [], errors: [], skipped: 0 };
  const existingSet = new Set(
    existingTransactions.map((t) => `${t.date}|${t.amount}|${t.description.slice(0, 20)}`)
  );

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    try {
      const dateRaw = row[columnMapping.date] || '';
      const description = row[columnMapping.description] || '';
      const amountRaw = row[columnMapping.amount] || '0';
      const category = columnMapping.category >= 0 ? (row[columnMapping.category] || '') : '';

      const date = parseDate(dateRaw, dateFormat);
      const amount = Math.abs(parseFloat(amountRaw.replace(/[^0-9.\-]/g, '')) || 0);

      if (!date || amount === 0) {
        result.errors.push({ row: i + 1, message: 'Missing date or amount' });
        continue;
      }

      const type = parseFloat(amountRaw.replace(/[^0-9.\-]/g, '')) >= 0 ? 'income' : 'cost';
      const key = `${date}|${amount}|${description.slice(0, 20)}`;

      if (existingSet.has(key)) {
        result.skipped++;
        continue;
      }

      result.transactions.push({
        date,
        type: type as 'income' | 'cost',
        amount,
        description,
        category: category || 'Other ' + (type === 'income' ? 'Income' : 'Cost'),
        clientId: null,
        invoiceId: null,
        projectId: null,
        notes: '',
        vatRate: null,
        vatAmount: 0,
        taxDeductible: type === 'cost',
        attachments: [],
        currency: null,
        exchangeRate: null,
        originalAmount: null,
        recurrence: null,
        reconciliationStatus: 'unreconciled',
        importedFrom: 'csv-import',
      });
    } catch {
      result.errors.push({ row: i + 1, message: 'Failed to parse row' });
    }
  }

  return result;
}

export function getCSVHeaders(csvText: string): string[] {
  const rows = parseCSV(csvText);
  return rows.length > 0 ? rows[0] : [];
}

export function getCSVPreview(csvText: string, maxRows: number = 5): string[][] {
  const rows = parseCSV(csvText);
  return rows.slice(0, maxRows + 1);
}
