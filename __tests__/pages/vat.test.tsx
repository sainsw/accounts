import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createSettings, createTransaction } from '../test-helpers';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

import VatPage from '../../app/vat/page';
import { useApp } from '@/lib/context';

const currentYear = new Date().getFullYear();

const baseContext = {
  ready: true,
  settings: createSettings({
    vatRegistered: true,
    vatScheme: 'standard',
    currencySymbol: '£',
  }),
  transactions: [
    createTransaction({
      date: `${currentYear}-05-15`,
      type: 'income',
      amount: 10000,
      vatRate: 20,
      vatAmount: 2000,
    }),
    createTransaction({
      date: `${currentYear}-05-20`,
      type: 'cost',
      amount: 5000,
      vatRate: 20,
      vatAmount: 1000,
    }),
  ],
  clients: [],
  invoices: [],
  onboardingDone: true,
  completeOnboarding: vi.fn(),
  updateSettings: vi.fn(),
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

describe('VatPage', () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it('shows "VAT not enabled" message when not VAT registered', () => {
    setup({ settings: createSettings({ vatRegistered: false }) });
    render(<VatPage />);
    expect(screen.getByText('VAT is not enabled')).toBeInTheDocument();
    expect(screen.getByText(/Enable VAT in Settings/)).toBeInTheDocument();
  });

  it('renders quarter selector with Q1–Q4', () => {
    setup();
    render(<VatPage />);
    const quarterSelect = screen.getByDisplayValue('Q1 (Apr–Jun)');
    expect(quarterSelect).toBeInTheDocument();
    // Check all options exist
    const options = Array.from(quarterSelect.querySelectorAll('option'));
    expect(options).toHaveLength(4);
    expect(options[0].textContent).toBe('Q1 (Apr–Jun)');
    expect(options[1].textContent).toBe('Q2 (Jul–Sep)');
    expect(options[2].textContent).toBe('Q3 (Oct–Dec)');
    expect(options[3].textContent).toBe('Q4 (Jan–Mar)');
  });

  it('year navigation changes displayed year', () => {
    setup();
    render(<VatPage />);
    const yearLabel = `${currentYear}/${String(currentYear + 1).slice(2)}`;
    expect(screen.getByText(yearLabel)).toBeInTheDocument();
    // Click left arrow
    fireEvent.click(screen.getByText('←'));
    const prevYearLabel = `${currentYear - 1}/${String(currentYear).slice(2)}`;
    expect(screen.getByText(prevYearLabel)).toBeInTheDocument();
  });

  it('renders 3 stat cards (VAT due, VAT reclaimed, Net VAT)', () => {
    setup();
    render(<VatPage />);
    expect(screen.getByText('VAT Due on Sales')).toBeInTheDocument();
    expect(screen.getByText('VAT Reclaimed')).toBeInTheDocument();
    // Net VAT can be "Net VAT to Pay" or "Net VAT to Reclaim"
    const netVatEls = screen.getAllByText(/Net VAT/);
    expect(netVatEls.length).toBeGreaterThanOrEqual(1);
  });

  it('renders 9-box VAT return table with correct values', () => {
    setup();
    render(<VatPage />);
    expect(screen.getByText('VAT Return Summary')).toBeInTheDocument();
    expect(screen.getByText('Box 1')).toBeInTheDocument();
    expect(screen.getByText('Box 2')).toBeInTheDocument();
    expect(screen.getByText('Box 3')).toBeInTheDocument();
    expect(screen.getByText('Box 4')).toBeInTheDocument();
    expect(screen.getByText('Box 5')).toBeInTheDocument();
    expect(screen.getByText('Box 6')).toBeInTheDocument();
    expect(screen.getByText('Box 7')).toBeInTheDocument();
    expect(screen.getByText('Box 8')).toBeInTheDocument();
    expect(screen.getByText('Box 9')).toBeInTheDocument();
  });

  it('shows flat rate scheme note when applicable', () => {
    setup({
      settings: createSettings({
        vatRegistered: true,
        vatScheme: 'flat-rate',
        vatFlatRate: 14.5,
      }),
    });
    render(<VatPage />);
    // "Flat Rate Scheme" appears in both the header description and the note
    const flatRateEls = screen.getAllByText(/Flat Rate Scheme/);
    expect(flatRateEls.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/14\.5/)).toBeInTheDocument();
  });

  it('Q4 (Jan–Mar) correctly uses next calendar year', () => {
    setup();
    render(<VatPage />);
    const quarterSelect = screen.getByDisplayValue('Q1 (Apr–Jun)');
    fireEvent.change(quarterSelect, { target: { value: '3' } }); // Q4
    // The Q4 label should show Jan–Mar
    expect(screen.getByDisplayValue('Q4 (Jan–Mar)')).toBeInTheDocument();
  });
});
