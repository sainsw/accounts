import type { BankStatementFormat, Transaction, CategorisationRule } from './types';

export type ParsedBankEntry = {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  type: 'income' | 'cost';
  matchedTransactionId: string | null;
  matchConfidence: number;
  suggestedCategory: string | null;
  status: 'pending' | 'matched' | 'created' | 'skipped';
};

export const BANK_PRESETS: Record<string, BankStatementFormat> = {
  monzo: {
    name: 'Monzo',
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    amountColumn: 'Amount',
    balanceColumn: 'Balance',
    creditColumn: null,
    debitColumn: null,
    dateFormat: 'DD/MM/YYYY',
    skipRows: 0,
    delimiter: ',',
  },
  starling: {
    name: 'Starling',
    dateColumn: 'Date',
    descriptionColumn: 'Reference',
    amountColumn: 'Amount (GBP)',
    balanceColumn: 'Balance (GBP)',
    creditColumn: null,
    debitColumn: null,
    dateFormat: 'DD/MM/YYYY',
    skipRows: 0,
    delimiter: ',',
  },
  barclays: {
    name: 'Barclays',
    dateColumn: 'Date',
    descriptionColumn: 'Memo',
    amountColumn: 'Amount',
    balanceColumn: null,
    creditColumn: null,
    debitColumn: null,
    dateFormat: 'DD/MM/YYYY',
    skipRows: 0,
    delimiter: ',',
  },
  hsbc: {
    name: 'HSBC',
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    amountColumn: '',
    balanceColumn: 'Balance',
    creditColumn: 'Credit Amount',
    debitColumn: 'Debit Amount',
    dateFormat: 'DD/MM/YYYY',
    skipRows: 0,
    delimiter: ',',
  },
  nationwide: {
    name: 'Nationwide',
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    amountColumn: '',
    balanceColumn: 'Balance',
    creditColumn: 'Paid in',
    debitColumn: 'Paid out',
    dateFormat: 'DD MMM YYYY',
    skipRows: 4,
    delimiter: ',',
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
  if (format === 'YYYY-MM-DD') {
    return cleaned;
  }
  if (format === 'DD MMM YYYY') {
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const parts = cleaned.split(' ');
    const d = parts[0].padStart(2, '0');
    const m = months[parts[1]] || '01';
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return cleaned;
}

function parseCSV(text: string, delimiter: string = ','): string[][] {
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
      } else if (ch === delimiter) {
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

export function parseBankStatement(
  csvText: string,
  format: BankStatementFormat
): ParsedBankEntry[] {
  const allRows = parseCSV(csvText, format.delimiter);
  const rows = allRows.slice(format.skipRows);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const findCol = (name: string): number =>
    headers.findIndex((h) => h === name.toLowerCase().trim());

  const dateIdx = findCol(format.dateColumn);
  const descIdx = findCol(format.descriptionColumn);
  const amtIdx = format.amountColumn ? findCol(format.amountColumn) : -1;
  const balIdx = format.balanceColumn ? findCol(format.balanceColumn) : -1;
  const creditIdx = format.creditColumn ? findCol(format.creditColumn) : -1;
  const debitIdx = format.debitColumn ? findCol(format.debitColumn) : -1;

  if (dateIdx === -1 || descIdx === -1) return [];

  const entries: ParsedBankEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[dateIdx]) continue;

    const date = parseDate(row[dateIdx], format.dateFormat);
    const description = row[descIdx] || '';
    let amount = 0;

    if (amtIdx >= 0 && row[amtIdx]) {
      amount = parseFloat(row[amtIdx].replace(/[^0-9.\-]/g, '')) || 0;
    } else if (creditIdx >= 0 && debitIdx >= 0) {
      const credit = parseFloat((row[creditIdx] || '0').replace(/[^0-9.\-]/g, '')) || 0;
      const debit = parseFloat((row[debitIdx] || '0').replace(/[^0-9.\-]/g, '')) || 0;
      amount = credit > 0 ? credit : -debit;
    }

    const balance = balIdx >= 0 && row[balIdx]
      ? parseFloat(row[balIdx].replace(/[^0-9.\-]/g, '')) || null
      : null;

    entries.push({
      id: crypto.randomUUID(),
      date,
      description,
      amount: Math.abs(amount),
      balance,
      type: amount >= 0 ? 'income' : 'cost',
      matchedTransactionId: null,
      matchConfidence: 0,
      suggestedCategory: null,
      status: 'pending',
    });
  }

  return entries;
}

export function autoMatchEntries(
  entries: ParsedBankEntry[],
  existingTransactions: Transaction[]
): ParsedBankEntry[] {
  return entries.map((entry) => {
    let bestMatch: Transaction | null = null;
    let bestConfidence = 0;

    for (const tx of existingTransactions) {
      if (Math.abs(tx.amount - entry.amount) > 0.01) continue;

      const dateDiff = Math.abs(
        new Date(tx.date).getTime() - new Date(entry.date).getTime()
      );
      const daysDiff = dateDiff / (1000 * 60 * 60 * 24);

      if (daysDiff > 5) continue;

      let confidence = 0.5;
      if (daysDiff === 0) confidence += 0.3;
      else if (daysDiff <= 1) confidence += 0.2;
      else if (daysDiff <= 3) confidence += 0.1;

      if (tx.description.toLowerCase().includes(entry.description.toLowerCase().slice(0, 10))) {
        confidence += 0.2;
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = tx;
      }
    }

    if (bestMatch && bestConfidence >= 0.5) {
      return {
        ...entry,
        matchedTransactionId: bestMatch.id,
        matchConfidence: bestConfidence,
        status: 'matched' as const,
      };
    }

    return entry;
  });
}

export function applyCategorisationRules(
  entries: ParsedBankEntry[],
  rules: CategorisationRule[]
): ParsedBankEntry[] {
  return entries.map((entry) => {
    for (const rule of rules) {
      if (entry.description.toLowerCase().includes(rule.pattern.toLowerCase())) {
        if (rule.type === entry.type) {
          return { ...entry, suggestedCategory: rule.category };
        }
      }
    }
    return entry;
  });
}

export function detectDuplicates(
  entries: ParsedBankEntry[],
  existingTransactions: Transaction[]
): Set<string> {
  const duplicateIds = new Set<string>();

  for (const entry of entries) {
    const isDup = existingTransactions.some(
      (tx) =>
        tx.amount === entry.amount &&
        tx.date === entry.date &&
        tx.importedFrom !== null
    );
    if (isDup) duplicateIds.add(entry.id);
  }

  return duplicateIds;
}

export function getColumnHeaders(csvText: string, delimiter: string = ','): string[] {
  const rows = parseCSV(csvText, delimiter);
  return rows.length > 0 ? rows[0] : [];
}
