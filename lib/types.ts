export type TransactionType = 'income' | 'cost';

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

export type Settings = {
  businessName: string;
  businessAddress: string;
  email: string;
  phone: string;
  currencySymbol: string;
  taxYear: 'calendar' | 'apr-mar' | 'jul-jun' | 'oct-sep';
  taxRate: number;
  incomeCategories: string[];
  costCategories: string[];
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
