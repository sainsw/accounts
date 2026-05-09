import type { Settings } from './types';

export const DEFAULT_INCOME_CATEGORIES = [
  'Consulting',
  'Development',
  'Design',
  'Writing',
  'Teaching',
  'Retainer',
  'Royalties',
  'Other Income',
];

export const DEFAULT_COST_CATEGORIES = [
  'Software & Tools',
  'Hardware & Equipment',
  'Office Supplies',
  'Travel',
  'Meals & Entertainment',
  'Professional Services',
  'Insurance',
  'Marketing & Advertising',
  'Education & Training',
  'Bank Fees',
  'Taxes & Licenses',
  'Utilities',
  'Rent',
  'Other Cost',
];

export const defaultSettings: Settings = {
  businessName: '',
  businessAddress: '',
  email: '',
  phone: '',
  currencySymbol: '$',
  taxYear: 'calendar',
  taxRate: 0,
  incomeCategories: DEFAULT_INCOME_CATEGORIES,
  costCategories: DEFAULT_COST_CATEGORIES,
};

export const STORAGE_KEYS = {
  settings: 'accounts.settings',
  transactions: 'accounts.transactions',
  clients: 'accounts.clients',
  invoices: 'accounts.invoices',
} as const;
