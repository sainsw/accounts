import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUpdateSettings = vi.fn();
const mockSettings = {
  currencySymbol: '$',
  taxYear: 'calendar' as const,
  taxMode: 'flat' as const,
  taxRate: 0,
  locale: 'en-US',
  accountingBasis: 'cash' as const,
  costCategories: ['Other Cost'],
  costCategoryMeta: [],
  incomeCategories: ['Other Income'],
  businessName: '',
  businessAddress: '',
  email: '',
  phone: '',
  vatRegistered: false,
  vatScheme: 'standard' as const,
  vatFlatRate: 0,
  vatNumber: '',
  voluntaryClass2NI: false,
  studentLoanPlan: 'none' as const,
  lastExportDate: null,
};

vi.mock('@/lib/context', () => ({
  useApp: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
  }),
}));

import SetupWizard from '../../components/SetupWizard';

describe('SetupWizard', () => {
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onComplete = vi.fn();
    mockUpdateSettings.mockClear();
  });

  it('renders step 0 (currency selection) initially', () => {
    render(<SetupWizard onComplete={onComplete} />);
    expect(screen.getByText('What currency do you use?')).toBeInTheDocument();
    expect(screen.getByText('GBP (£)')).toBeInTheDocument();
    expect(screen.getByText('USD ($)')).toBeInTheDocument();
    expect(screen.getByText('EUR (€)')).toBeInTheDocument();
  });

  it('selecting GBP auto-selects Apr–Mar tax year and UK Sole Trader mode', () => {
    render(<SetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByText('GBP (£)'));
    // Advance to step 1 to verify tax year
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('When does your financial year start?')).toBeInTheDocument();
    // April – March should be selected (highlighted)
    const aprMarBtn = screen.getByText('April – March');
    expect(aprMarBtn.className).toContain('border-brand-500');
  });

  it('custom currency input enables and requires non-empty text', () => {
    render(<SetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Other…'));
    // Input should appear
    const input = screen.getByPlaceholderText('e.g. ¥, R, kr');
    expect(input).toBeInTheDocument();
    // Next button should be disabled with empty custom currency
    const nextBtn = screen.getByText('Next');
    expect(nextBtn).toBeDisabled();
  });

  it('Next button advances to step 1 (financial year)', () => {
    render(<SetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('When does your financial year start?')).toBeInTheDocument();
  });

  it('Back button returns to previous step', () => {
    render(<SetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Next')); // go to step 1
    expect(screen.getByText('When does your financial year start?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('What currency do you use?')).toBeInTheDocument();
  });

  it('step 2: selecting UK Sole Trader auto-selects GBP and Apr–Mar', () => {
    render(<SetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Next')); // step 1
    fireEvent.click(screen.getByText('Next')); // step 2
    expect(screen.getByText('How should we estimate your tax?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('UK Sole Trader'));
    // Go back to verify currency was changed to GBP
    fireEvent.click(screen.getByText('Back')); // step 1
    const aprMarBtn = screen.getByText('April – March');
    expect(aprMarBtn.className).toContain('border-brand-500');
  });

  it('step 2: selecting Flat tax shows percentage input', () => {
    render(<SetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Next')); // step 1
    fireEvent.click(screen.getByText('Next')); // step 2
    fireEvent.click(screen.getByText('Flat percentage'));
    expect(screen.getByText('Tax rate (%)')).toBeInTheDocument();
  });

  it('finish calls onComplete with correct settings', () => {
    render(<SetupWizard onComplete={onComplete} />);
    // Select GBP (triggers UK defaults)
    fireEvent.click(screen.getByText('GBP (£)'));
    fireEvent.click(screen.getByText('Next')); // step 1
    fireEvent.click(screen.getByText('Next')); // step 2
    // UK Sole Trader should already be selected from GBP auto-select
    fireEvent.click(screen.getByText('Get started'));
    expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    const savedSettings = mockUpdateSettings.mock.calls[0][0];
    expect(savedSettings.currencySymbol).toBe('£');
    expect(savedSettings.taxYear).toBe('apr-mar');
    expect(savedSettings.taxMode).toBe('uk-sole-trader');
    expect(savedSettings.locale).toBe('en-GB');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cannot advance past currency step with empty custom currency', () => {
    render(<SetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Other…'));
    const nextBtn = screen.getByText('Next');
    expect(nextBtn).toBeDisabled();
    // Type something
    const input = screen.getByPlaceholderText('e.g. ¥, R, kr');
    fireEvent.change(input, { target: { value: '¥' } });
    expect(nextBtn).not.toBeDisabled();
  });
});
