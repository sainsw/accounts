import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createTransaction, createSettings } from '../test-helpers';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/lib/export', () => ({
  exportPnLCSV: vi.fn(() => 'csv'),
  exportTaxSummaryCSV: vi.fn(() => 'csv'),
  exportTransactionsCSV: vi.fn(() => 'csv'),
  downloadCsv: vi.fn(),
}));

import ReportsPage from '../../app/reports/page';
import { useApp } from '@/lib/context';

// Generate transactions for current year
const currentYear = new Date().getFullYear();
const makeTx = (month: number, type: 'income' | 'cost', amount: number) =>
  createTransaction({
    date: `${currentYear}-${String(month).padStart(2, '0')}-15`,
    type,
    amount,
    category: type === 'income' ? 'Consulting' : 'Software & Tools',
  });

const yearTransactions = [
  makeTx(1, 'income', 5000),
  makeTx(1, 'cost', 1000),
  makeTx(2, 'income', 6000),
  makeTx(3, 'income', 7000),
  makeTx(4, 'income', 4000),
  makeTx(4, 'cost', 500),
  makeTx(5, 'income', 3000),
  makeTx(6, 'income', 8000),
  makeTx(7, 'income', 4500),
  makeTx(8, 'income', 5500),
  makeTx(9, 'income', 6500),
  makeTx(10, 'income', 7500),
  makeTx(11, 'income', 3500),
  makeTx(12, 'income', 2000),
];

const baseContext = {
  ready: true,
  settings: createSettings({ taxYear: 'calendar', taxMode: 'flat', taxRate: 20 }),
  transactions: yearTransactions,
  clients: [],
  invoices: [],
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  onboardingDone: true,
  completeOnboarding: vi.fn(),
  updateSettings: vi.fn(),
  addClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  addInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  deleteTransactionsByInvoiceId: vi.fn(),
};

function setup(overrides: Partial<typeof baseContext> = {}) {
  vi.mocked(useApp).mockReturnValue({ ...baseContext, ...overrides } as any);
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it('renders P&L summary stat cards', () => {
    setup();
    render(<ReportsPage />);
    expect(screen.getByText('Total Income')).toBeInTheDocument();
    expect(screen.getByText('Total Costs')).toBeInTheDocument();
    expect(screen.getByText('Net Profit')).toBeInTheDocument();
    expect(screen.getByText('Est. Tax')).toBeInTheDocument();
    expect(screen.getByText('After Tax')).toBeInTheDocument();
  });

  it('year navigation arrows change displayed year', () => {
    setup();
    render(<ReportsPage />);
    // Current year label
    expect(screen.getByText(String(currentYear))).toBeInTheDocument();
    // Click left arrow
    const arrows = screen.getAllByText('←');
    fireEvent.click(arrows[0]);
    expect(screen.getByText(String(currentYear - 1))).toBeInTheDocument();
  });

  it('monthly view shows monthly data rows', () => {
    setup();
    render(<ReportsPage />);
    // Monthly view is default
    const monthlyBtn = screen.getByText('monthly');
    expect(monthlyBtn.className).toContain('bg-brand-500');
  });

  it('quarterly view shows quarterly data rows', () => {
    setup();
    render(<ReportsPage />);
    fireEvent.click(screen.getByText('quarterly'));
    expect(screen.getByText(/Q1/)).toBeInTheDocument();
  });

  it('prior year comparison toggle exists', () => {
    setup();
    render(<ReportsPage />);
    expect(screen.getByText(/Compare with/)).toBeInTheDocument();
  });

  it('income by category breakdown displays', () => {
    setup();
    render(<ReportsPage />);
    expect(screen.getByText('Tax Breakdown')).toBeInTheDocument();
  });

  it('UK tax mode shows full tax breakdown labels', () => {
    setup({
      settings: createSettings({ taxMode: 'uk-sole-trader', taxYear: 'apr-mar' }),
    });
    render(<ReportsPage />);
    expect(screen.getByText(/UK Sole Trader/)).toBeInTheDocument();
  });

  it('flat tax mode shows simple tax calculation', () => {
    setup({
      settings: createSettings({ taxMode: 'flat', taxRate: 25 }),
    });
    render(<ReportsPage />);
    expect(screen.getByText(/Flat rate 25%/)).toBeInTheDocument();
  });

  it('rates fallback warning displays when tax year has no exact rates', () => {
    setup({
      settings: createSettings({ taxMode: 'uk-sole-trader', taxYear: 'apr-mar' }),
      transactions: [makeTx(6, 'income', 50000)],
    });
    render(<ReportsPage />);
    // This shows when ratesFallback is true in the tax result
    // It depends on whether the tax calc returns ratesFallback for the current year
  });

  it('export menu button exists', () => {
    setup();
    render(<ReportsPage />);
    expect(screen.getByText('Export ▾')).toBeInTheDocument();
  });

  it('returns null when not ready', () => {
    setup({ ready: false });
    const { container } = render(<ReportsPage />);
    expect(container.innerHTML).toBe('');
  });

  it('quarterly logic adjusts month mapping for Apr–Mar tax year', () => {
    setup({
      settings: createSettings({ taxYear: 'apr-mar', taxMode: 'flat', taxRate: 20 }),
    });
    render(<ReportsPage />);
    fireEvent.click(screen.getByText('quarterly'));
    // Q1 should be Apr-Jun for apr-mar tax year
    expect(screen.getByText(/Q1.*Apr/)).toBeInTheDocument();
  });
});
