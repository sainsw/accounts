'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  Client,
  Settings,
  TrackedInvoice,
  Transaction,
} from './types';
import { defaultSettings, STORAGE_KEYS } from './defaults';
import { usePersistentState } from '@/hooks/usePersistentState';
import { generateId, todayString } from './utils';

export function migrateTransaction(t: Partial<Transaction> & { id: string }): Transaction {
  return {
    date: '',
    type: 'cost',
    amount: 0,
    description: '',
    category: '',
    clientId: null,
    invoiceId: null,
    notes: '',
    vatRate: null,
    vatAmount: 0,
    taxDeductible: true,
    attachments: [],
    ...t,
  };
}

type AppContextValue = {
  ready: boolean;
  onboardingDone: boolean;
  completeOnboarding: () => void;
  settings: Settings;
  updateSettings: (s: Settings) => void;

  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;

  clients: Client[];
  addClient: (c: Omit<Client, 'id' | 'createdAt'>) => void;
  updateClient: (c: Client) => void;
  deleteClient: (id: string) => void;

  invoices: TrackedInvoice[];
  addInvoice: (i: Omit<TrackedInvoice, 'id'>) => void;
  updateInvoice: (i: TrackedInvoice) => void;
  deleteInvoice: (id: string) => void;
  deleteTransactionsByInvoiceId: (invoiceId: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const settingsState = usePersistentState(STORAGE_KEYS.settings, () => defaultSettings);

  const settings: Settings = useMemo(
    () => ({ ...defaultSettings, ...settingsState.value }),
    [settingsState.value]
  );

  const txState = usePersistentState<Transaction[]>(STORAGE_KEYS.transactions, () => []);
  const clientState = usePersistentState<Client[]>(STORAGE_KEYS.clients, () => []);
  const invoiceState = usePersistentState<TrackedInvoice[]>(STORAGE_KEYS.invoices, () => []);
  const onboardingState = usePersistentState<boolean>(STORAGE_KEYS.onboardingDone, () => false);

  const ready =
    settingsState.ready && txState.ready && clientState.ready && invoiceState.ready && onboardingState.ready;

  const transactions = useMemo(
    () => txState.value.map(migrateTransaction),
    [txState.value]
  );

  const completeOnboarding = useCallback(() => {
    onboardingState.setValue(true);
  }, [onboardingState]);

  const addTransaction = useCallback(
    (t: Omit<Transaction, 'id'>) => {
      txState.setValue((prev) => [{ ...t, id: generateId() }, ...prev]);
    },
    [txState]
  );

  const updateTransaction = useCallback(
    (t: Transaction) => {
      txState.setValue((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    },
    [txState]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      txState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [txState]
  );

  const addClient = useCallback(
    (c: Omit<Client, 'id' | 'createdAt'>) => {
      clientState.setValue((prev) => [
        { ...c, id: generateId(), createdAt: todayString() },
        ...prev,
      ]);
    },
    [clientState]
  );

  const updateClient = useCallback(
    (c: Client) => {
      clientState.setValue((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    },
    [clientState]
  );

  const deleteClient = useCallback(
    (id: string) => {
      clientState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [clientState]
  );

  const addInvoice = useCallback(
    (i: Omit<TrackedInvoice, 'id'>) => {
      const invoiceId = generateId();
      invoiceState.setValue((prev) => [{ ...i, id: invoiceId }, ...prev]);

      if (i.status === 'paid') {
        const tx: Transaction = {
          id: generateId(),
          date: i.paidDate || todayString(),
          type: 'income',
          amount: i.amount,
          description: `Invoice ${i.invoiceNumber} — ${i.clientName}`,
          category: 'Consulting',
          clientId: i.clientId,
          invoiceId,
          notes: '',
          vatRate: null,
          vatAmount: 0,
          taxDeductible: true,
          attachments: [],
        };
        txState.setValue((prev) => [tx, ...prev]);
      }
    },
    [invoiceState, txState]
  );

  const updateInvoice = useCallback(
    (i: TrackedInvoice) => {
      invoiceState.setValue((prev) => prev.map((x) => (x.id === i.id ? i : x)));

      if (i.status === 'paid') {
        txState.setValue((prev) => {
          const exists = prev.some((t) => t.invoiceId === i.id);
          if (exists) return prev;
          const tx: Transaction = {
            id: generateId(),
            date: i.paidDate || todayString(),
            type: 'income',
            amount: i.amount,
            description: `Invoice ${i.invoiceNumber} — ${i.clientName}`,
            category: 'Consulting',
            clientId: i.clientId,
            invoiceId: i.id,
            notes: '',
            vatRate: null,
            vatAmount: 0,
            taxDeductible: true,
            attachments: [],
          };
          return [tx, ...prev];
        });
      } else {
        txState.setValue((prev) => prev.filter((t) => t.invoiceId !== i.id));
      }
    },
    [invoiceState, txState]
  );

  const deleteInvoice = useCallback(
    (id: string) => {
      invoiceState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [invoiceState]
  );

  const deleteTransactionsByInvoiceId = useCallback(
    (invoiceId: string) => {
      txState.setValue((prev) => prev.filter((t) => t.invoiceId !== invoiceId));
    },
    [txState]
  );

  const value = useMemo(
    (): AppContextValue => ({
      ready,
      onboardingDone: onboardingState.value,
      completeOnboarding,
      settings,
      updateSettings: settingsState.setValue,
      transactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      clients: clientState.value,
      addClient,
      updateClient,
      deleteClient,
      invoices: invoiceState.value,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      deleteTransactionsByInvoiceId,
    }),
    [
      ready,
      onboardingState.value,
      completeOnboarding,
      settings,
      settingsState.setValue,
      transactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      clientState.value,
      addClient,
      updateClient,
      deleteClient,
      invoiceState.value,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      deleteTransactionsByInvoiceId,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
