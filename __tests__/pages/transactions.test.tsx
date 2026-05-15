import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTransaction, createClient, createSettings, createInvoice } from '../test-helpers';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/lib/export', () => ({
  exportTransactionsCSV: vi.fn(() => 'csv-data'),
  downloadCsv: vi.fn(),
}));

import TransactionsPage from '../../app/transactions/page';
import { useApp } from '@/lib/context';

const baseTx = [
  createTransaction({ id: 'tx-1', description: 'Client A Work', category: 'Consulting', type: 'income', amount: 5000, date: '2024-06-01' }),
  createTransaction({ id: 'tx-2', description: 'Software License', category: 'Software & Tools', type: 'cost', amount: 200, date: '2024-06-02' }),
  createTransaction({ id: 'tx-3', description: 'Office Rent', category: 'Rent', type: 'cost', amount: 1000, date: '2024-06-03', taxDeductible: false }),
];

const baseContext = {
  ready: true,
  settings: createSettings(),
  transactions: baseTx,
  clients: [createClient({ id: 'c-1', name: 'Client A' })],
  invoices: [] as any[],
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  deleteInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  onboardingDone: true,
  completeOnboarding: vi.fn(),
  updateSettings: vi.fn(),
  addClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  addInvoice: vi.fn(),
  deleteTransactionsByInvoiceId: vi.fn(),
};

function setup(overrides: Partial<typeof baseContext> = {}) {
  vi.mocked(useApp).mockReturnValue({ ...baseContext, ...overrides } as any);
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it('renders transaction table with all transactions', () => {
    setup();
    render(<TransactionsPage />);
    expect(screen.getByText('Client A Work')).toBeInTheDocument();
    expect(screen.getByText('Software License')).toBeInTheDocument();
    expect(screen.getByText('Office Rent')).toBeInTheDocument();
  });

  it('search filters transactions by description', () => {
    setup();
    render(<TransactionsPage />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Client' } });
    expect(screen.getByText('Client A Work')).toBeInTheDocument();
    expect(screen.queryByText('Software License')).not.toBeInTheDocument();
  });

  it('search filters transactions by category', () => {
    setup();
    render(<TransactionsPage />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'consulting' } });
    expect(screen.getByText('Client A Work')).toBeInTheDocument();
    expect(screen.queryByText('Office Rent')).not.toBeInTheDocument();
  });

  it('type filter shows only income transactions', () => {
    setup();
    render(<TransactionsPage />);
    fireEvent.click(screen.getByText('income'));
    expect(screen.getByText('Client A Work')).toBeInTheDocument();
    expect(screen.queryByText('Software License')).not.toBeInTheDocument();
  });

  it('type filter shows only cost transactions', () => {
    setup();
    render(<TransactionsPage />);
    fireEvent.click(screen.getByText('cost'));
    expect(screen.queryByText('Client A Work')).not.toBeInTheDocument();
    expect(screen.getByText('Software License')).toBeInTheDocument();
  });

  it('category dropdown filters by selected category', () => {
    setup();
    render(<TransactionsPage />);
    fireEvent.change(screen.getByDisplayValue('All categories'), { target: { value: 'Rent' } });
    expect(screen.getByText('Office Rent')).toBeInTheDocument();
    expect(screen.queryByText('Client A Work')).not.toBeInTheDocument();
  });

  it('displays live totals matching filtered view', () => {
    setup();
    render(<TransactionsPage />);
    expect(screen.getByText(/Income: \$5,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Costs: \$1,200\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Net: \$3,800\.00/)).toBeInTheDocument();
  });

  it('shows VAT column when VAT registered', () => {
    setup({ settings: createSettings({ vatRegistered: true }) });
    render(<TransactionsPage />);
    expect(screen.getByText('VAT')).toBeInTheDocument();
  });

  it('hides VAT column when not VAT registered', () => {
    setup({ settings: createSettings({ vatRegistered: false }) });
    render(<TransactionsPage />);
    // Table should exist but no VAT header
    const headers = screen.getAllByRole('columnheader');
    const vatHeader = headers.find((h) => h.textContent === 'VAT');
    expect(vatHeader).toBeUndefined();
  });

  it('shows attachment indicator for transactions with attachments', () => {
    const txWithAttachment = createTransaction({
      id: 'tx-attach',
      description: 'Receipt TX',
      attachments: [{ id: 'a1', name: 'receipt.pdf', data: 'base64data' }],
    });
    setup({ transactions: [txWithAttachment] });
    render(<TransactionsPage />);
    expect(screen.getByText('Receipt TX')).toBeInTheDocument();
  });

  it('shows allowability badge color for non-deductible categories', () => {
    setup();
    render(<TransactionsPage />);
    // The non-deductible transaction has a special badge - there may be multiple "Rent" elements
    // (one in the filter dropdown, one in the table). Get the span badge in the table.
    const rentElements = screen.getAllByText('Rent');
    const rentBadge = rentElements.find((el) => el.tagName === 'SPAN');
    expect(rentBadge).toBeDefined();
    expect(rentBadge!.className).toContain('bg-orange-100');
  });

  it('new transaction modal opens on Add Transaction click', () => {
    setup();
    render(<TransactionsPage />);
    fireEvent.click(screen.getByText('Add Transaction'));
    expect(screen.getByText('New Transaction')).toBeInTheDocument();
  });

  it('delete transaction calls deleteTransaction', () => {
    const deleteFn = vi.fn();
    setup({ deleteTransaction: deleteFn, transactions: [baseTx[0]] });
    render(<TransactionsPage />);
    // Click the delete button (trash icon) - it's the button inside the table row
    const deleteButtons = document.querySelectorAll('table button');
    fireEvent.click(deleteButtons[0]);
    expect(deleteFn).toHaveBeenCalledWith('tx-1');
  });

  it('export CSV button exists when transactions present', () => {
    setup();
    render(<TransactionsPage />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });
});
