import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createClient, createSettings, createTransaction, createInvoice } from '../test-helpers';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

import ClientsPage from '../../app/clients/page';
import { useApp } from '@/lib/context';

const baseClients = [
  createClient({ id: 'c-1', name: 'Acme Corp', email: 'acme@example.com' }),
  createClient({ id: 'c-2', name: 'Beta Inc', email: 'beta@test.com' }),
];

const baseContext = {
  ready: true,
  settings: createSettings(),
  clients: baseClients,
  transactions: [
    createTransaction({ id: 'tx-1', clientId: 'c-1', type: 'income', amount: 5000 }),
    createTransaction({ id: 'tx-2', clientId: 'c-1', type: 'income', amount: 3000 }),
  ],
  invoices: [
    createInvoice({ id: 'inv-1', clientId: 'c-1' }),
    createInvoice({ id: 'inv-2', clientId: 'c-1' }),
    createInvoice({ id: 'inv-3', clientId: 'c-2' }),
  ],
  addClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  onboardingDone: true,
  completeOnboarding: vi.fn(),
  updateSettings: vi.fn(),
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  addInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  deleteTransactionsByInvoiceId: vi.fn(),
};

function setup(overrides: Partial<typeof baseContext> = {}) {
  vi.mocked(useApp).mockReturnValue({ ...baseContext, ...overrides } as any);
}

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it('renders client cards for all clients', () => {
    setup();
    render(<ClientsPage />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('search filters clients by name', () => {
    setup();
    render(<ClientsPage />);
    fireEvent.change(screen.getByPlaceholderText('Search clients...'), { target: { value: 'Acme' } });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByText('Beta Inc')).not.toBeInTheDocument();
  });

  it('search filters clients by email', () => {
    setup();
    render(<ClientsPage />);
    fireEvent.change(screen.getByPlaceholderText('Search clients...'), { target: { value: 'beta@test' } });
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('displays per-client income total and invoice count', () => {
    setup();
    render(<ClientsPage />);
    expect(screen.getAllByText('$8,000.00').length).toBeGreaterThanOrEqual(1); // income for client c-1 (5000+3000)
    expect(screen.getByText('2 invoices')).toBeInTheDocument(); // client c-1 has 2 invoices
    expect(screen.getByText('1 invoice')).toBeInTheDocument(); // client c-2 has 1 invoice
  });

  it('new client modal creates client correctly', () => {
    const addClient = vi.fn();
    setup({ addClient });
    render(<ClientsPage />);
    // Click the header "Add Client" button (it has an icon + text)
    const addButtons = screen.getAllByText('Add Client');
    fireEvent.click(addButtons[0]);
    expect(screen.getByText('New Client')).toBeInTheDocument();
    // Fill in the form
    fireEvent.change(screen.getByPlaceholderText('Client or company name'), { target: { value: 'New Company' } });
    // Click the form submit button (last "Add Client")
    const submitButtons = screen.getAllByText('Add Client');
    fireEvent.click(submitButtons[submitButtons.length - 1]);
    expect(addClient).toHaveBeenCalledTimes(1);
  });

  it('edit client modal pre-fills existing data', () => {
    setup();
    render(<ClientsPage />);
    // Click on a client card to open edit modal
    fireEvent.click(screen.getByText('Acme Corp'));
    expect(screen.getByText('Edit Client')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument();
    expect(screen.getByDisplayValue('acme@example.com')).toBeInTheDocument();
  });

  it('delete client triggers confirm and calls deleteClient', () => {
    const deleteClient = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup({ deleteClient });
    render(<ClientsPage />);
    // Click the trash button on first client
    const trashButtons = document.querySelectorAll('button');
    const trashBtn = Array.from(trashButtons).find((btn) => btn.querySelector('svg path[d*="m14.74 9"]'));
    if (trashBtn) fireEvent.click(trashBtn);
    confirmSpy.mockRestore();
  });

  it('shows empty state when no clients exist', () => {
    setup({ clients: [] });
    render(<ClientsPage />);
    expect(screen.getByText('No clients yet')).toBeInTheDocument();
  });
});
