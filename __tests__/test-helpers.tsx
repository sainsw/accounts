import { render, type RenderResult } from '@testing-library/react';
import { AppProvider } from '@/lib/context';
import { STORAGE_KEYS, defaultSettings } from '@/lib/defaults';
import type { Client, Settings, TrackedInvoice, Transaction } from '@/lib/types';

export type InitialState = {
  transactions?: Transaction[];
  clients?: Client[];
  invoices?: TrackedInvoice[];
  settings?: Partial<Settings>;
  onboardingDone?: boolean;
};

export function seedLocalStorage(state: InitialState = {}): void {
  if (state.transactions !== undefined) {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
  }
  if (state.clients !== undefined) {
    localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(state.clients));
  }
  if (state.invoices !== undefined) {
    localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(state.invoices));
  }
  if (state.settings !== undefined) {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ ...defaultSettings, ...state.settings })
    );
  }
  if (state.onboardingDone !== undefined) {
    localStorage.setItem(STORAGE_KEYS.onboardingDone, JSON.stringify(state.onboardingDone));
  }
}

export function renderWithApp(
  ui: React.ReactElement,
  initialState: InitialState = {}
): RenderResult {
  seedLocalStorage(initialState);
  return render(<AppProvider>{ui}</AppProvider>);
}

export function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    date: '2024-06-15',
    type: 'income',
    amount: 100,
    description: 'Test transaction',
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

export function createClient(overrides: Partial<Client> = {}): Client {
  return {
    id: `client-${Math.random().toString(36).slice(2)}`,
    name: 'Test Client',
    email: 'test@example.com',
    phone: '',
    address: '',
    notes: '',
    createdAt: '2024-01-01',
    ...overrides,
  };
}

export function createInvoice(overrides: Partial<TrackedInvoice> = {}): TrackedInvoice {
  return {
    id: `inv-${Math.random().toString(36).slice(2)}`,
    invoiceNumber: 'INV-001',
    clientId: null,
    clientName: 'Test Client',
    issueDate: '2024-06-01',
    dueDate: '2024-06-30',
    amount: 1000,
    status: 'sent',
    paidDate: null,
    notes: '',
    ...overrides,
  };
}

export function createSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...defaultSettings, ...overrides };
}
