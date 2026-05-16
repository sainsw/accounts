'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type {
  Asset,
  Budget,
  CategorisationRule,
  Client,
  Liability,
  MileageEntry,
  Project,
  Settings,
  TrackedInvoice,
  Transaction,
  WfhEntry,
} from './types';
import { defaultSettings, STORAGE_KEYS } from './defaults';
import { usePersistentState } from '@/hooks/usePersistentState';
import { generateId, todayString } from './utils';
import { getDueRecurringTransactions, generateFromRecurring, getDueRecurringInvoices, incrementInvoiceNumber } from './recurring';

export function migrateTransaction(t: Partial<Transaction> & { id: string }): Transaction {
  return {
    date: '',
    type: 'cost',
    amount: 0,
    description: '',
    category: '',
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
  addTransaction: (t: Partial<Omit<Transaction, 'id'>> & Pick<Transaction, 'date' | 'type' | 'amount' | 'description' | 'category'>) => void;
  updateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;

  clients: Client[];
  addClient: (c: Omit<Client, 'id' | 'createdAt'>) => void;
  updateClient: (c: Client) => void;
  deleteClient: (id: string) => void;

  invoices: TrackedInvoice[];
  addInvoice: (i: Omit<TrackedInvoice, 'id'>) => string;
  updateInvoice: (i: TrackedInvoice) => void;
  deleteInvoice: (id: string) => void;
  deleteTransactionsByInvoiceId: (invoiceId: string) => void;

  mileageEntries: MileageEntry[];
  addMileageEntry: (e: Omit<MileageEntry, 'id'>) => void;
  updateMileageEntry: (e: MileageEntry) => void;
  deleteMileageEntry: (id: string) => void;

  wfhEntries: WfhEntry[];
  addWfhEntry: (e: Omit<WfhEntry, 'id'>) => void;
  updateWfhEntry: (e: WfhEntry) => void;
  deleteWfhEntry: (id: string) => void;

  projects: Project[];
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => void;
  updateProject: (p: Project) => void;
  deleteProject: (id: string) => void;

  assets: Asset[];
  addAsset: (a: Omit<Asset, 'id'>) => void;
  updateAsset: (a: Asset) => void;
  deleteAsset: (id: string) => void;

  liabilities: Liability[];
  addLiability: (l: Omit<Liability, 'id'>) => void;
  updateLiability: (l: Liability) => void;
  deleteLiability: (id: string) => void;

  budgets: Budget[];
  addBudget: (b: Omit<Budget, 'id'>) => void;
  updateBudget: (b: Budget) => void;
  deleteBudget: (id: string) => void;

  categorisationRules: CategorisationRule[];
  addRule: (r: Omit<CategorisationRule, 'id' | 'createdAt'>) => void;
  updateRule: (r: CategorisationRule) => void;
  deleteRule: (id: string) => void;

  importData: (data: {
    transactions?: Transaction[];
    clients?: Client[];
    invoices?: TrackedInvoice[];
    mileageEntries?: MileageEntry[];
    wfhEntries?: WfhEntry[];
    projects?: Project[];
    assets?: Asset[];
    liabilities?: Liability[];
    budgets?: Budget[];
    categorisationRules?: CategorisationRule[];
    settings?: Settings;
  }, mode: 'replace' | 'merge') => void;
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
  const mileageState = usePersistentState<MileageEntry[]>(STORAGE_KEYS.mileageEntries, () => []);
  const wfhState = usePersistentState<WfhEntry[]>(STORAGE_KEYS.wfhEntries, () => []);
  const projectState = usePersistentState<Project[]>(STORAGE_KEYS.projects, () => []);
  const assetState = usePersistentState<Asset[]>(STORAGE_KEYS.assets, () => []);
  const liabilityState = usePersistentState<Liability[]>(STORAGE_KEYS.liabilities, () => []);
  const budgetState = usePersistentState<Budget[]>(STORAGE_KEYS.budgets, () => []);
  const ruleState = usePersistentState<CategorisationRule[]>(STORAGE_KEYS.categorisationRules, () => []);

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
    (t: Partial<Omit<Transaction, 'id'>> & Pick<Transaction, 'date' | 'type' | 'amount' | 'description' | 'category'>) => {
      const full: Transaction = {
        id: generateId(),
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
        ...t,
      };
      txState.setValue((prev) => [full, ...prev]);
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
      return invoiceId;
    },
    [invoiceState]
  );

  const updateInvoice = useCallback(
    (i: TrackedInvoice) => {
      invoiceState.setValue((prev) => prev.map((x) => (x.id === i.id ? i : x)));
    },
    [invoiceState]
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

  // Auto-generate due recurring transactions and invoices once on load
  const recurringProcessed = useRef(false);
  useEffect(() => {
    if (!ready || recurringProcessed.current) return;
    recurringProcessed.current = true;

    const today = todayString();

    // Process recurring transactions
    const dueTransactions = getDueRecurringTransactions(transactions, today);
    for (const { template, nextDate } of dueTransactions) {
      const newTx = generateFromRecurring(template, nextDate);
      addTransaction(newTx);
      updateTransaction({
        ...template,
        recurrence: { ...template.recurrence!, lastGenerated: nextDate },
      });
    }

    // Process recurring invoices
    const dueInvoices = getDueRecurringInvoices(invoiceState.value, today);
    for (const { template, nextDate } of dueInvoices) {
      const newInvoice = {
        ...template,
        invoiceNumber: incrementInvoiceNumber(template.invoiceNumber),
        issueDate: nextDate,
        status: 'draft' as const,
        recurrence: null,
      };
      const { id: _, ...withoutId } = newInvoice;
      addInvoice(withoutId);
      updateInvoice({
        ...template,
        recurrence: { ...template.recurrence!, lastGenerated: nextDate },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const addMileageEntry = useCallback(
    (e: Omit<MileageEntry, 'id'>) => {
      mileageState.setValue((prev) => [{ ...e, id: generateId() }, ...prev]);
    },
    [mileageState]
  );

  const updateMileageEntry = useCallback(
    (e: MileageEntry) => {
      mileageState.setValue((prev) => prev.map((x) => (x.id === e.id ? e : x)));
    },
    [mileageState]
  );

  const deleteMileageEntry = useCallback(
    (id: string) => {
      mileageState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [mileageState]
  );

  const addWfhEntry = useCallback(
    (e: Omit<WfhEntry, 'id'>) => {
      wfhState.setValue((prev) => [{ ...e, id: generateId() }, ...prev]);
    },
    [wfhState]
  );

  const updateWfhEntry = useCallback(
    (e: WfhEntry) => {
      wfhState.setValue((prev) => prev.map((x) => (x.id === e.id ? e : x)));
    },
    [wfhState]
  );

  const deleteWfhEntry = useCallback(
    (id: string) => {
      wfhState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [wfhState]
  );

  const addProject = useCallback(
    (p: Omit<Project, 'id' | 'createdAt'>) => {
      projectState.setValue((prev) => [{ ...p, id: generateId(), createdAt: todayString() }, ...prev]);
    },
    [projectState]
  );

  const updateProject = useCallback(
    (p: Project) => {
      projectState.setValue((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    },
    [projectState]
  );

  const deleteProject = useCallback(
    (id: string) => {
      projectState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [projectState]
  );

  const addAsset = useCallback(
    (a: Omit<Asset, 'id'>) => {
      assetState.setValue((prev) => [{ ...a, id: generateId() }, ...prev]);
    },
    [assetState]
  );

  const updateAsset = useCallback(
    (a: Asset) => {
      assetState.setValue((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    },
    [assetState]
  );

  const deleteAsset = useCallback(
    (id: string) => {
      assetState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [assetState]
  );

  const addLiability = useCallback(
    (l: Omit<Liability, 'id'>) => {
      liabilityState.setValue((prev) => [{ ...l, id: generateId() }, ...prev]);
    },
    [liabilityState]
  );

  const updateLiability = useCallback(
    (l: Liability) => {
      liabilityState.setValue((prev) => prev.map((x) => (x.id === l.id ? l : x)));
    },
    [liabilityState]
  );

  const deleteLiability = useCallback(
    (id: string) => {
      liabilityState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [liabilityState]
  );

  const addBudget = useCallback(
    (b: Omit<Budget, 'id'>) => {
      budgetState.setValue((prev) => [{ ...b, id: generateId() }, ...prev]);
    },
    [budgetState]
  );

  const updateBudget = useCallback(
    (b: Budget) => {
      budgetState.setValue((prev) => prev.map((x) => (x.id === b.id ? b : x)));
    },
    [budgetState]
  );

  const deleteBudget = useCallback(
    (id: string) => {
      budgetState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [budgetState]
  );

  const addRule = useCallback(
    (r: Omit<CategorisationRule, 'id' | 'createdAt'>) => {
      ruleState.setValue((prev) => [{ ...r, id: generateId(), createdAt: todayString() }, ...prev]);
    },
    [ruleState]
  );

  const updateRule = useCallback(
    (r: CategorisationRule) => {
      ruleState.setValue((prev) => prev.map((x) => (x.id === r.id ? r : x)));
    },
    [ruleState]
  );

  const deleteRule = useCallback(
    (id: string) => {
      ruleState.setValue((prev) => prev.filter((x) => x.id !== id));
    },
    [ruleState]
  );

  const importData = useCallback(
    (data: Parameters<AppContextValue['importData']>[0], mode: 'replace' | 'merge') => {
      if (mode === 'replace') {
        if (data.settings) settingsState.setValue(data.settings);
        if (data.transactions) txState.setValue(data.transactions);
        if (data.clients) clientState.setValue(data.clients);
        if (data.invoices) invoiceState.setValue(data.invoices);
        if (data.mileageEntries) mileageState.setValue(data.mileageEntries);
        if (data.wfhEntries) wfhState.setValue(data.wfhEntries);
        if (data.projects) projectState.setValue(data.projects);
        if (data.assets) assetState.setValue(data.assets);
        if (data.liabilities) liabilityState.setValue(data.liabilities);
        if (data.budgets) budgetState.setValue(data.budgets);
        if (data.categorisationRules) ruleState.setValue(data.categorisationRules);
      } else {
        const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
          const ids = new Set(existing.map((x) => x.id));
          return [...existing, ...incoming.filter((x) => !ids.has(x.id))];
        };
        if (data.transactions) txState.setValue((prev) => mergeById(prev, data.transactions!));
        if (data.clients) clientState.setValue((prev) => mergeById(prev, data.clients!));
        if (data.invoices) invoiceState.setValue((prev) => mergeById(prev, data.invoices!));
        if (data.mileageEntries) mileageState.setValue((prev) => mergeById(prev, data.mileageEntries!));
        if (data.wfhEntries) wfhState.setValue((prev) => mergeById(prev, data.wfhEntries!));
        if (data.projects) projectState.setValue((prev) => mergeById(prev, data.projects!));
        if (data.assets) assetState.setValue((prev) => mergeById(prev, data.assets!));
        if (data.liabilities) liabilityState.setValue((prev) => mergeById(prev, data.liabilities!));
        if (data.budgets) budgetState.setValue((prev) => mergeById(prev, data.budgets!));
        if (data.categorisationRules) ruleState.setValue((prev) => mergeById(prev, data.categorisationRules!));
      }
    },
    [settingsState, txState, clientState, invoiceState, mileageState, wfhState, projectState, assetState, liabilityState, budgetState, ruleState]
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
      mileageEntries: mileageState.value,
      addMileageEntry,
      updateMileageEntry,
      deleteMileageEntry,
      wfhEntries: wfhState.value,
      addWfhEntry,
      updateWfhEntry,
      deleteWfhEntry,
      projects: projectState.value,
      addProject,
      updateProject,
      deleteProject,
      assets: assetState.value,
      addAsset,
      updateAsset,
      deleteAsset,
      liabilities: liabilityState.value,
      addLiability,
      updateLiability,
      deleteLiability,
      budgets: budgetState.value,
      addBudget,
      updateBudget,
      deleteBudget,
      categorisationRules: ruleState.value,
      addRule,
      updateRule,
      deleteRule,
      importData,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ready, onboardingState.value, completeOnboarding, settings, settingsState.setValue,
      transactions, addTransaction, updateTransaction, deleteTransaction,
      clientState.value, addClient, updateClient, deleteClient,
      invoiceState.value, addInvoice, updateInvoice, deleteInvoice, deleteTransactionsByInvoiceId,
      mileageState.value, addMileageEntry, updateMileageEntry, deleteMileageEntry,
      wfhState.value, addWfhEntry, updateWfhEntry, deleteWfhEntry,
      projectState.value, addProject, updateProject, deleteProject,
      assetState.value, addAsset, updateAsset, deleteAsset,
      liabilityState.value, addLiability, updateLiability, deleteLiability,
      budgetState.value, addBudget, updateBudget, deleteBudget,
      ruleState.value, addRule, updateRule, deleteRule,
      importData,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
