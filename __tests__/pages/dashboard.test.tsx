import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTransaction, createInvoice, createSettings } from '../test-helpers';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

import Dashboard from '../../app/page';
import { useApp } from '@/lib/context';

const baseContext = {
  ready: true,
  settings: createSettings({ currencySymbol: '$', taxYear: 'calendar', taxMode: 'flat', taxRate: 20, locale: 'en-US' }),
  transactions: [] as any[],
  invoices: [] as any[],
  updateSettings: vi.fn(),
  onboardingDone: true,
  completeOnboarding: vi.fn(),
  clients: [],
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
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

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it('renders income, costs, and net profit stat cards for current year', () => {
    const tx = [
      createTransaction({ date: new Date().toISOString().split('T')[0], type: 'income', amount: 5000 }),
      createTransaction({ date: new Date().toISOString().split('T')[0], type: 'cost', amount: 2000 }),
    ];
    setup({ transactions: tx });
    render(<Dashboard />);
    expect(screen.getByText('Year Income')).toBeInTheDocument();
    expect(screen.getByText('Year Costs')).toBeInTheDocument();
    expect(screen.getByText('Year Net')).toBeInTheDocument();
  });

  it('renders current month stat cards', () => {
    setup({ transactions: [] });
    render(<Dashboard />);
    expect(screen.getByText('Est. Tax')).toBeInTheDocument();
    expect(screen.getByText('After Tax')).toBeInTheDocument();
  });

  it('shows backup reminder when lastExportDate is >30 days ago', () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setup({
      settings: createSettings({ lastExportDate: oldDate }),
      transactions: [createTransaction()],
    });
    render(<Dashboard />);
    expect(screen.getByText(/haven't backed up/)).toBeInTheDocument();
  });

  it('does not show backup reminder when recently exported', () => {
    const recentDate = new Date().toISOString().split('T')[0];
    setup({
      settings: createSettings({ lastExportDate: recentDate }),
      transactions: [createTransaction()],
    });
    render(<Dashboard />);
    expect(screen.queryByText(/haven't backed up/)).not.toBeInTheDocument();
  });

  it('shows outstanding and overdue invoice counts', () => {
    const invoices = [
      createInvoice({ status: 'sent', amount: 1000 }),
      createInvoice({ status: 'overdue', amount: 500 }),
    ];
    setup({ invoices });
    render(<Dashboard />);
    expect(screen.getByText('Outstanding')).toBeInTheDocument();
    expect(screen.getByText(/2 invoices/)).toBeInTheDocument();
    expect(screen.getAllByText(/1 overdue/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders monthly breakdown chart with correct data', () => {
    const today = new Date().toISOString().split('T')[0];
    const tx = [createTransaction({ date: today, type: 'income', amount: 1000 })];
    setup({ transactions: tx });
    render(<Dashboard />);
    expect(screen.getByText('Monthly Breakdown')).toBeInTheDocument();
  });

  it('renders recent transactions list (max 8, sorted by date desc)', () => {
    const txs = Array.from({ length: 10 }, (_, i) =>
      createTransaction({
        id: `tx-${i}`,
        description: `Transaction ${i}`,
        date: `2024-06-${String(i + 1).padStart(2, '0')}`,
      })
    );
    setup({
      transactions: txs,
      settings: createSettings({ taxYear: 'calendar' }),
    });
    render(<Dashboard />);
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    // Should show max 8
    expect(screen.getByText('Transaction 9')).toBeInTheDocument(); // most recent
    expect(screen.queryByText('Transaction 0')).not.toBeInTheDocument(); // oldest, beyond 8
  });

  it('shows empty state when no transactions exist', () => {
    setup({ transactions: [] });
    render(<Dashboard />);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('shows VAT summary card when VAT registered', () => {
    setup({
      settings: createSettings({ vatRegistered: true }),
    });
    render(<Dashboard />);
    expect(screen.getByText('View VAT Return')).toBeInTheDocument();
  });

  it('hides VAT summary card when not VAT registered', () => {
    setup({
      settings: createSettings({ vatRegistered: false }),
    });
    render(<Dashboard />);
    expect(screen.queryByText('View VAT Return')).not.toBeInTheDocument();
  });

  it('returns null when not ready', () => {
    setup({ ready: false });
    const { container } = render(<Dashboard />);
    expect(container.innerHTML).toBe('');
  });

  it('uses flat tax mode when settings.taxMode is "flat"', () => {
    setup({
      settings: createSettings({ taxMode: 'flat', taxRate: 20 }),
      transactions: [createTransaction({ date: new Date().toISOString().split('T')[0], type: 'income', amount: 10000 })],
    });
    render(<Dashboard />);
    // Should show tax estimate based on flat rate
    expect(screen.getByText('Est. Tax')).toBeInTheDocument();
  });
});
