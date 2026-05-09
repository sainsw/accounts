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
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const settingsState = usePersistentState(STORAGE_KEYS.settings, () => defaultSettings);

  // Migrate stale localStorage: merge defaults so new keys are always present
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
        // Create income transaction if one doesn't already exist for this invoice
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
          };
          return [tx, ...prev];
        });
      } else {
        // If status changed away from paid, remove the auto-created transaction
        txState.setValue((prev) => prev.filter((t) => t.invoiceId !== i.id));
      }
    },
    [invoiceState, txState]
  );

  const deleteInvoice = useCallback(
    (id: string) => {
      invoiceState.setValue((prev) => prev.filter((x) => x.id !== id));
      // Remove any auto-created transaction linked to this invoice
      txState.setValue((prev) => prev.filter((t) => t.invoiceId !== id));
    },
    [invoiceState, txState]
  );

  const value = useMemo(
    (): AppContextValue => ({
      ready,
      onboardingDone: onboardingState.value,
      completeOnboarding,
      settings,
      updateSettings: settingsState.setValue,
      transactions: txState.value,
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
    }),
    [
      ready,
      onboardingState.value,
      completeOnboarding,
      settings,
      settingsState.setValue,
      txState.value,
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
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
