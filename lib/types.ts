export type TransactionType = 'income' | 'cost';

export type Attachment = {
  id: string;
  name: string;
  data: string;
};

export type Transaction = {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  clientId: string | null;
  invoiceId: string | null;
  notes: string;
  vatRate: number | null;
  vatAmount: number;
  taxDeductible: boolean;
  attachments: Attachment[];
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
