import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createSettings } from '../test-helpers';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/lib/export', () => ({
  exportTransactionsCSV: vi.fn(() => 'csv'),
  exportInvoicesCSV: vi.fn(() => 'csv'),
  downloadCsv: vi.fn(),
}));

import SettingsPage from '../../app/settings/page';
import { useApp } from '@/lib/context';

const baseContext = {
  ready: true,
  settings: createSettings({
    businessName: 'My Business',
    email: 'me@test.com',
    phone: '123-456',
    currencySymbol: '$',
    taxMode: 'flat' as const,
    taxRate: 20,
    vatRegistered: false,
    incomeCategories: ['Consulting', 'Development'],
    costCategories: ['Software & Tools', 'Travel'],
    costCategoryMeta: [],
  }),
  transactions: [],
  clients: [],
  invoices: [],
  updateSettings: vi.fn(),
  onboardingDone: true,
  completeOnboarding: vi.fn(),
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

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it('renders all settings sections', () => {
    setup();
    render(<SettingsPage />);
    expect(screen.getByText('Business Information')).toBeInTheDocument();
    expect(screen.getByText('Tax Settings')).toBeInTheDocument();
    expect(screen.getByText('VAT Settings')).toBeInTheDocument();
    expect(screen.getByText('Income Categories')).toBeInTheDocument();
    expect(screen.getByText('Cost Categories')).toBeInTheDocument();
    expect(screen.getByText('Data Management')).toBeInTheDocument();
  });

  it('business info fields save on change', () => {
    const updateSettings = vi.fn();
    setup({ updateSettings });
    render(<SettingsPage />);
    const nameInput = screen.getByDisplayValue('My Business');
    fireEvent.change(nameInput, { target: { value: 'New Business' } });
    expect(updateSettings).toHaveBeenCalled();
  });

  it('tax mode toggle between flat and UK sole trader', () => {
    setup();
    render(<SettingsPage />);
    const taxSelect = screen.getByDisplayValue('Flat Rate');
    expect(taxSelect).toBeInTheDocument();
  });

  it('flat rate percentage input appears only in flat mode', () => {
    setup({
      settings: createSettings({ taxMode: 'flat', taxRate: 20 }),
    });
    render(<SettingsPage />);
    expect(screen.getByText('Estimated Tax Rate (%)')).toBeInTheDocument();
  });

  it('UK mode shows accounting basis, student loan, Class 2 NI, locale fields', () => {
    setup({
      settings: createSettings({ taxMode: 'uk-sole-trader' }),
    });
    render(<SettingsPage />);
    expect(screen.getByText('Accounting Basis')).toBeInTheDocument();
    expect(screen.getByText('Student Loan Plan')).toBeInTheDocument();
    expect(screen.getByText(/voluntarily pay Class 2 NI/)).toBeInTheDocument();
    expect(screen.getByText('Locale')).toBeInTheDocument();
  });

  it('flat rate percentage input does not appear in UK mode', () => {
    setup({
      settings: createSettings({ taxMode: 'uk-sole-trader' }),
    });
    render(<SettingsPage />);
    expect(screen.queryByText('Estimated Tax Rate (%)')).not.toBeInTheDocument();
  });

  it('VAT registered toggle shows/hides VAT scheme fields', () => {
    setup({
      settings: createSettings({ vatRegistered: false }),
    });
    const { rerender } = render(<SettingsPage />);
    expect(screen.queryByText('VAT Scheme')).not.toBeInTheDocument();

    // Now render with VAT registered
    vi.mocked(useApp).mockReturnValue({
      ...baseContext,
      settings: createSettings({ vatRegistered: true }),
    } as any);
    rerender(<SettingsPage />);
    expect(screen.getByText('VAT Scheme')).toBeInTheDocument();
  });

  it('VAT scheme selection shows standard, flat-rate, cash-accounting', () => {
    setup({
      settings: createSettings({ vatRegistered: true }),
    });
    render(<SettingsPage />);
    const vatSchemeSelect = screen.getByDisplayValue('Standard');
    expect(vatSchemeSelect).toBeInTheDocument();
  });

  it('income category add works', () => {
    const updateSettings = vi.fn();
    setup({ updateSettings });
    render(<SettingsPage />);
    // Find the income category input
    const inputs = screen.getAllByPlaceholderText('New category');
    const incomeInput = inputs[0];
    fireEvent.change(incomeInput, { target: { value: 'Teaching' } });
    // Click Add button (first one)
    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]);
    expect(updateSettings).toHaveBeenCalled();
  });

  it('income category remove works', () => {
    const updateSettings = vi.fn();
    setup({ updateSettings });
    render(<SettingsPage />);
    // Category tags have × buttons
    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]); // remove first income category
    expect(updateSettings).toHaveBeenCalled();
  });

  it('reset income categories to defaults', () => {
    const updateSettings = vi.fn();
    setup({ updateSettings });
    render(<SettingsPage />);
    const resetButtons = screen.getAllByText('Reset');
    fireEvent.click(resetButtons[0]); // first Reset is for income categories
    expect(updateSettings).toHaveBeenCalled();
  });

  it('export backup button exists', () => {
    setup();
    render(<SettingsPage />);
    expect(screen.getByText('Full Backup (JSON)')).toBeInTheDocument();
  });

  it('auto-save flash message appears on settings change', async () => {
    const updateSettings = vi.fn();
    setup({ updateSettings });
    render(<SettingsPage />);
    const nameInput = screen.getByDisplayValue('My Business');
    fireEvent.change(nameInput, { target: { value: 'Changed' } });
    expect(screen.getByText('Saved automatically')).toBeInTheDocument();
  });
});
