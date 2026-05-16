import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AppProvider, useApp, migrateTransaction } from '../lib/context';
import { seedLocalStorage, createTransaction, createClient, createInvoice } from './test-helpers';

// Test component that exposes context values for assertions
function TestHarness({
  onContext,
}: {
  onContext?: (ctx: ReturnType<typeof useApp>) => void;
}) {
  const ctx = useApp();
  if (onContext) onContext(ctx);
  return (
    <div>
      <span data-testid="ready">{String(ctx.ready)}</span>
      <span data-testid="tx-count">{ctx.transactions.length}</span>
      <span data-testid="client-count">{ctx.clients.length}</span>
      <span data-testid="invoice-count">{ctx.invoices.length}</span>
      <span data-testid="onboarding">{String(ctx.onboardingDone)}</span>
      <span data-testid="currency">{ctx.settings.currencySymbol}</span>
      <span data-testid="tx-json">{JSON.stringify(ctx.transactions)}</span>
      <span data-testid="invoice-json">{JSON.stringify(ctx.invoices)}</span>
    </div>
  );
}

function TransactionActions() {
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useApp();
  return (
    <div>
      <span data-testid="tx-count">{transactions.length}</span>
      <span data-testid="tx-json">{JSON.stringify(transactions)}</span>
      <button
        onClick={() =>
          addTransaction({
            date: '2024-06-15',
            type: 'income',
            amount: 500,
            description: 'Test income',
            category: 'Consulting',
            clientId: null,
            invoiceId: null,
            notes: '',
            vatRate: null,
            vatAmount: 0,
            taxDeductible: true,
            attachments: [],
          })
        }
      >
        Add TX
      </button>
      <button
        onClick={() => {
          if (transactions[0]) {
            updateTransaction({ ...transactions[0], description: 'Updated' });
          }
        }}
      >
        Update TX
      </button>
      <button
        onClick={() => {
          if (transactions[0]) deleteTransaction(transactions[0].id);
        }}
      >
        Delete TX
      </button>
    </div>
  );
}

function ClientActions() {
  const { clients, addClient, updateClient, deleteClient } = useApp();
  return (
    <div>
      <span data-testid="client-count">{clients.length}</span>
      <span data-testid="client-json">{JSON.stringify(clients)}</span>
      <button
        onClick={() =>
          addClient({
            name: 'New Client',
            email: 'new@example.com',
            phone: '',
            address: '',
            notes: '',
          })
        }
      >
        Add Client
      </button>
      <button
        onClick={() => {
          if (clients[0]) updateClient({ ...clients[0], name: 'Updated Client' });
        }}
      >
        Update Client
      </button>
      <button
        onClick={() => {
          if (clients[0]) deleteClient(clients[0].id);
        }}
      >
        Delete Client
      </button>
    </div>
  );
}

function InvoiceActions() {
  const { invoices, transactions, addInvoice, updateInvoice, deleteInvoice, deleteTransactionsByInvoiceId } = useApp();
  return (
    <div>
      <span data-testid="invoice-count">{invoices.length}</span>
      <span data-testid="tx-count">{transactions.length}</span>
      <span data-testid="invoice-json">{JSON.stringify(invoices)}</span>
      <span data-testid="tx-json">{JSON.stringify(transactions)}</span>
      <button
        onClick={() =>
          addInvoice({
            invoiceNumber: 'INV-100',
            clientId: null,
            clientName: 'Acme',
            issueDate: '2024-06-01',
            dueDate: '2024-06-30',
            amount: 1000,
            status: 'paid',
            paidDate: '2024-06-15',
            notes: '',
          })
        }
      >
        Add Paid Invoice
      </button>
      <button
        onClick={() =>
          addInvoice({
            invoiceNumber: 'INV-101',
            clientId: null,
            clientName: 'Draft Co',
            issueDate: '2024-06-01',
            dueDate: '2024-06-30',
            amount: 500,
            status: 'draft',
            paidDate: null,
            notes: '',
          })
        }
      >
        Add Draft Invoice
      </button>
      <button
        onClick={() => {
          if (invoices[0]) {
            updateInvoice({ ...invoices[0], status: 'paid', paidDate: '2024-07-01' });
          }
        }}
      >
        Mark Paid
      </button>
      <button
        onClick={() => {
          if (invoices[0]) {
            updateInvoice({ ...invoices[0], status: 'sent', paidDate: null });
          }
        }}
      >
        Mark Sent
      </button>
      <button
        onClick={() => {
          if (invoices[0]) deleteInvoice(invoices[0].id);
        }}
      >
        Delete Invoice
      </button>
      <button
        onClick={() => {
          if (invoices[0]) deleteTransactionsByInvoiceId(invoices[0].id);
        }}
      >
        Delete TX By Invoice
      </button>
    </div>
  );
}

function SettingsActions() {
  const { settings, updateSettings, completeOnboarding, onboardingDone } = useApp();
  return (
    <div>
      <span data-testid="currency">{settings.currencySymbol}</span>
      <span data-testid="tax-mode">{settings.taxMode}</span>
      <span data-testid="onboarding">{String(onboardingDone)}</span>
      <button
        onClick={() => updateSettings({ ...settings, currencySymbol: '£' })}
      >
        Change Currency
      </button>
      <button onClick={completeOnboarding}>Complete Onboarding</button>
    </div>
  );
}

async function renderAndWait(ui: React.ReactElement) {
  const result = render(ui);
  await act(async () => {});
  return result;
}

describe('AppProvider', () => {
  it('renders children when ready', async () => {
    seedLocalStorage({});
    await renderAndWait(
      <AppProvider>
        <TestHarness />
      </AppProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
    });
  });
});

describe('useApp', () => {
  it('throws when used outside AppProvider', () => {
    // Suppress console.error for the expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestHarness />)).toThrow('useApp must be inside AppProvider');
    spy.mockRestore();
  });
});

describe('Transaction CRUD', () => {
  it('addTransaction adds a transaction to state', async () => {
    seedLocalStorage({});
    await renderAndWait(
      <AppProvider>
        <TransactionActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('0')
    );
    fireEvent.click(screen.getByText('Add TX'));
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('1')
    );
  });

  it('updateTransaction modifies an existing transaction by ID', async () => {
    const tx = createTransaction({ id: 'tx-1', description: 'Original' });
    seedLocalStorage({ transactions: [tx] });
    await renderAndWait(
      <AppProvider>
        <TransactionActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('tx-json')).toHaveTextContent('Original')
    );
    fireEvent.click(screen.getByText('Update TX'));
    await waitFor(() =>
      expect(screen.getByTestId('tx-json')).toHaveTextContent('Updated')
    );
  });

  it('deleteTransaction removes a transaction by ID', async () => {
    const tx = createTransaction({ id: 'tx-1' });
    seedLocalStorage({ transactions: [tx] });
    await renderAndWait(
      <AppProvider>
        <TransactionActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('1')
    );
    fireEvent.click(screen.getByText('Delete TX'));
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('0')
    );
  });
});

describe('Client CRUD', () => {
  it('addClient adds a client to state', async () => {
    seedLocalStorage({});
    await renderAndWait(
      <AppProvider>
        <ClientActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('client-count')).toHaveTextContent('0')
    );
    fireEvent.click(screen.getByText('Add Client'));
    await waitFor(() =>
      expect(screen.getByTestId('client-count')).toHaveTextContent('1')
    );
  });

  it('updateClient modifies an existing client by ID', async () => {
    const client = createClient({ id: 'c-1', name: 'Original' });
    seedLocalStorage({ clients: [client] });
    await renderAndWait(
      <AppProvider>
        <ClientActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('client-json')).toHaveTextContent('Original')
    );
    fireEvent.click(screen.getByText('Update Client'));
    await waitFor(() =>
      expect(screen.getByTestId('client-json')).toHaveTextContent('Updated Client')
    );
  });

  it('deleteClient removes a client by ID', async () => {
    const client = createClient({ id: 'c-1' });
    seedLocalStorage({ clients: [client] });
    await renderAndWait(
      <AppProvider>
        <ClientActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('client-count')).toHaveTextContent('1')
    );
    fireEvent.click(screen.getByText('Delete Client'));
    await waitFor(() =>
      expect(screen.getByTestId('client-count')).toHaveTextContent('0')
    );
  });
});

describe('Invoice CRUD & auto-transactions', () => {
  it('addInvoice adds an invoice to state', async () => {
    seedLocalStorage({});
    await renderAndWait(
      <AppProvider>
        <InvoiceActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('invoice-count')).toHaveTextContent('0')
    );
    fireEvent.click(screen.getByText('Add Draft Invoice'));
    await waitFor(() =>
      expect(screen.getByTestId('invoice-count')).toHaveTextContent('1')
    );
  });

  it('deleteInvoice removes an invoice by ID without removing linked transactions', async () => {
    const inv = createInvoice({ id: 'inv-1' });
    const tx = createTransaction({ id: 'tx-linked', invoiceId: 'inv-1' });
    seedLocalStorage({ invoices: [inv], transactions: [tx] });
    await renderAndWait(
      <AppProvider>
        <InvoiceActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('invoice-count')).toHaveTextContent('1')
    );
    fireEvent.click(screen.getByText('Delete Invoice'));
    await waitFor(() => {
      expect(screen.getByTestId('invoice-count')).toHaveTextContent('0');
      // Transaction should still exist
      expect(screen.getByTestId('tx-count')).toHaveTextContent('1');
    });
  });

  it('deleteTransactionsByInvoiceId removes only transactions linked to the given invoice', async () => {
    const inv = createInvoice({ id: 'inv-1' });
    const txLinked = createTransaction({ id: 'tx-linked', invoiceId: 'inv-1' });
    const txOther = createTransaction({ id: 'tx-other', invoiceId: null });
    seedLocalStorage({ invoices: [inv], transactions: [txLinked, txOther] });
    await renderAndWait(
      <AppProvider>
        <InvoiceActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('2')
    );
    fireEvent.click(screen.getByText('Delete TX By Invoice'));
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('1')
    );
  });

  it('addInvoice with status "paid" does not auto-create a transaction', async () => {
    seedLocalStorage({});
    await renderAndWait(
      <AppProvider>
        <InvoiceActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('0')
    );
    fireEvent.click(screen.getByText('Add Paid Invoice'));
    await waitFor(() => {
      expect(screen.getByTestId('invoice-count')).toHaveTextContent('1');
      expect(screen.getByTestId('tx-count')).toHaveTextContent('0');
    });
  });

  it('addInvoice with status "draft" does not create a transaction', async () => {
    seedLocalStorage({});
    await renderAndWait(
      <AppProvider>
        <InvoiceActions />
      </AppProvider>
    );
    fireEvent.click(screen.getByText('Add Draft Invoice'));
    await waitFor(() => {
      expect(screen.getByTestId('invoice-count')).toHaveTextContent('1');
      expect(screen.getByTestId('tx-count')).toHaveTextContent('0');
    });
  });

  it('updateInvoice does not auto-create or delete transactions', async () => {
    const inv = createInvoice({ id: 'inv-1', status: 'sent' });
    seedLocalStorage({ invoices: [inv] });
    await renderAndWait(
      <AppProvider>
        <InvoiceActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('0')
    );
    fireEvent.click(screen.getByText('Mark Paid'));
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('0')
    );
  });

  it('updateInvoice changing status from "paid" to "sent" preserves linked transactions', async () => {
    const inv = createInvoice({ id: 'inv-1', status: 'paid', paidDate: '2024-06-15' });
    const tx = createTransaction({ id: 'tx-auto', invoiceId: 'inv-1', type: 'income' });
    seedLocalStorage({ invoices: [inv], transactions: [tx] });
    await renderAndWait(
      <AppProvider>
        <InvoiceActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('1')
    );
    fireEvent.click(screen.getByText('Mark Sent'));
    await waitFor(() =>
      expect(screen.getByTestId('tx-count')).toHaveTextContent('1')
    );
  });
});

describe('migrateTransaction', () => {
  it('fills missing fields with defaults', () => {
    const partial = { id: 'tx-migrate', date: '2024-01-01', type: 'income' as const, amount: 100 };
    const result = migrateTransaction(partial);
    expect(result.id).toBe('tx-migrate');
    expect(result.date).toBe('2024-01-01');
    expect(result.type).toBe('income');
    expect(result.amount).toBe(100);
    // Filled-in defaults
    expect(result.attachments).toEqual([]);
    expect(result.vatRate).toBeNull();
    expect(result.vatAmount).toBe(0);
    expect(result.taxDeductible).toBe(true);
    expect(result.description).toBe('');
    expect(result.category).toBe('');
    expect(result.clientId).toBeNull();
    expect(result.invoiceId).toBeNull();
    expect(result.notes).toBe('');
  });
});

describe('Settings', () => {
  it('updateSettings merges partial settings with existing values', async () => {
    seedLocalStorage({ settings: { currencySymbol: '$', taxMode: 'flat' } });
    await renderAndWait(
      <AppProvider>
        <SettingsActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('currency')).toHaveTextContent('$')
    );
    fireEvent.click(screen.getByText('Change Currency'));
    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('£');
      // Tax mode should be preserved
      expect(screen.getByTestId('tax-mode')).toHaveTextContent('flat');
    });
  });

  it('completeOnboarding sets onboarding flag to true', async () => {
    seedLocalStorage({ onboardingDone: false });
    await renderAndWait(
      <AppProvider>
        <SettingsActions />
      </AppProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('onboarding')).toHaveTextContent('false')
    );
    fireEvent.click(screen.getByText('Complete Onboarding'));
    await waitFor(() =>
      expect(screen.getByTestId('onboarding')).toHaveTextContent('true')
    );
  });
});
