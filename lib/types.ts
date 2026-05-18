export type TransactionType = 'income' | 'cost';

export type Attachment = {
  id: string;
  name: string;
  data: string;
};

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type Recurrence = {
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string | null;
  lastGenerated: string | null;
  active: boolean;
};

export type ReconciliationStatus = 'unreconciled' | 'reconciled';

export type Transaction = {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  clientId: string | null;
  invoiceId: string | null;
  projectId: string | null;
  notes: string;
  vatRate: number | null;
  vatAmount: number;
  taxDeductible: boolean;
  attachments: Attachment[];
  currency: string | null;
  exchangeRate: number | null;
  originalAmount: number | null;
  recurrence: Recurrence | null;
  reconciliationStatus: ReconciliationStatus;
  importedFrom: string | null;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
};

export type InvoiceWorkBlock = {
  id: string;
  description: string;
  startDate: string;
  endDate: string;
  billingMode: 'daily' | 'block';
  dailyRate: number;
  blockTotal: number;
};

export type InvoiceExpense = {
  id: string;
  date: string;
  notes: string;
  amount: number;
};

export type ExtraReference = {
  id: string;
  label: string;
  value: string;
  showAtTop: boolean;
  showAtBottom: boolean;
};

export type InvoicingSettings = {
  bankDetails: string;
  defaultDailyRate: number;
  defaultPaymentTerms: number;
  defaultNotes: string;
  headerColor: string;
  bodyColor: string;
  filenameTemplate: string;
  extraReferences: ExtraReference[];
};

export type TrackedInvoice = {
  id: string;
  invoiceNumber: string;
  clientId: string | null;
  clientName: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  paidDate: string | null;
  notes: string;
  workBlocks?: InvoiceWorkBlock[];
  expenses?: InvoiceExpense[];
  taxRate?: number;
  purchaseOrder?: string;
  recurrence?: Recurrence | null;
};

export type Project = {
  id: string;
  name: string;
  clientId: string | null;
  description: string;
  active: boolean;
  createdAt: string;
};

export type MileageEntry = {
  id: string;
  date: string;
  description: string;
  from: string;
  to: string;
  miles: number;
  vehicleType: VehicleType;
  allowance: number;
  transactionId: string | null;
};

export type VehicleType = 'car' | 'motorcycle' | 'bicycle';

export type WfhEntry = {
  id: string;
  month: string;
  hoursPerMonth: number;
  allowance: number;
  transactionId: string | null;
};

export type Asset = {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseValue: number;
  usefulLifeYears: number;
  depreciationMethod: 'straight-line';
  disposedDate: string | null;
  disposalValue: number | null;
  notes: string;
};

export type Liability = {
  id: string;
  name: string;
  category: string;
  balance: number;
  interestRate: number;
  startDate: string;
  notes: string;
};

export type Budget = {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'annual';
  year: number;
};

export type CategorisationRule = {
  id: string;
  pattern: string;
  category: string;
  type: TransactionType;
  createdAt: string;
};

export type BankStatementFormat = {
  name: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  balanceColumn: string | null;
  creditColumn: string | null;
  debitColumn: string | null;
  dateFormat: string;
  skipRows: number;
  delimiter: string;
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'transaction' | 'invoice' | 'client' | 'settings' | 'mileage' | 'wfh' | 'asset' | 'liability' | 'project' | 'budget' | 'rule';
  entityId: string;
  before: unknown;
  after: unknown;
};

export type TaxMode = 'flat' | 'uk-sole-trader';

export type VatScheme = 'standard' | 'flat-rate' | 'cash-accounting';

export type StudentLoanPlan = 'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';

export type AccountingBasis = 'cash' | 'accruals';

export type CategoryAllowability = 'yes' | 'no' | 'partial';

export type CostCategoryMeta = {
  name: string;
  allowable: CategoryAllowability;
  note?: string;
};

export type Settings = {
  businessName: string;
  businessAddress: string;
  email: string;
  phone: string;
  currencySymbol: string;
  baseCurrency: string;
  taxYear: 'calendar' | 'apr-mar' | 'jul-jun' | 'oct-sep';
  taxMode: TaxMode;
  taxRate: number;
  incomeCategories: string[];
  costCategories: string[];
  costCategoryMeta: CostCategoryMeta[];
  locale: string;
  vatRegistered: boolean;
  vatScheme: VatScheme;
  vatFlatRate: number;
  vatNumber: string;
  voluntaryClass2NI: boolean;
  studentLoanPlan: StudentLoanPlan;
  accountingBasis: AccountingBasis;
  lastExportDate: string | null;
  invoicing: InvoicingSettings;
  logoData: string | null;
  highContrast?: boolean;
};

export type BackupData = {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  settings: Settings;
  transactions: Transaction[];
  clients: Client[];
  invoices: TrackedInvoice[];
  mileageEntries: MileageEntry[];
  wfhEntries: WfhEntry[];
  projects: Project[];
  assets: Asset[];
  liabilities: Liability[];
  budgets: Budget[];
  categorisationRules: CategorisationRule[];
  auditLog: AuditLogEntry[];
  attachments?: Array<{ id: string; transactionId: string; name: string; mimeType: string; data: string }>;
};

export type TaxBandResult = {
  name: string;
  from: number;
  to: number | null;
  rate: number;
  taxableAmount: number;
  tax: number;
};

export type TaxBreakdown = {
  grossProfit: number;
  grossIncome: number;
  allowableCosts: number;
  nonAllowableCosts: number;
  tradingAllowanceUsed: boolean;
  incomeTaxBands: TaxBandResult[];
  incomeTax: number;
  class2NI: number;
  class2NIVoluntary: boolean;
  class4NIBands: TaxBandResult[];
  class4NI: number;
  totalNI: number;
  studentLoanRepayment: number;
  studentLoanPlan: StudentLoanPlan;
  totalTax: number;
  afterTax: number;
  taxYear: string;
  ratesYear: string;
  ratesFallback: boolean;
  paymentsOnAccount: {
    applies: boolean;
    firstPayment: number;
    secondPayment: number;
    firstPaymentDate: string;
    secondPaymentDate: string;
  };
};

export type DateRange = {
  start: string;
  end: string;
};

export type MonthlySummary = {
  month: string;
  income: number;
  costs: number;
  net: number;
};

export type VatReturn = {
  box1: number;
  box2: number;
  box3: number;
  box4: number;
  box5: number;
  box6: number;
  box7: number;
  box8: number;
  box9: number;
};
