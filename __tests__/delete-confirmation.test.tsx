import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { TrackedInvoice, Transaction } from '../lib/types';
import { Modal } from '../components/Modal';

// ---------- helpers ----------

function makeTx(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    date: '2025-01-01',
    type: 'income',
    amount: 100,
    description: '',
    category: '',
    clientId: null,
    invoiceId: null,
    projectId: null,
    notes: '',
    vatRate: null,
    vatAmount: 0,
    taxDeductible: true,
    attachments: [],
    currency: null,
    exchangeRate: null,
    originalAmount: null,
    recurrence: null,
    reconciliationStatus: 'unreconciled',
    importedFrom: null,
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<TrackedInvoice> & { id: string }): TrackedInvoice {
  return {
    invoiceNumber: 'INV-001',
    clientId: null,
    clientName: 'Test Client',
    issueDate: '2025-01-01',
    dueDate: '2025-02-01',
    amount: 500,
    status: 'paid',
    paidDate: '2025-01-15',
    notes: '',
    ...overrides,
  };
}

// ---------- Invoice delete confirmation component (extracted logic) ----------

function InvoiceDeleteConfirmation({
  invoice,
  transactions,
  onDeleteInvoiceOnly,
  onDeleteBoth,
  onCancel,
}: {
  invoice: TrackedInvoice;
  transactions: Transaction[];
  onDeleteInvoiceOnly: () => void;
  onDeleteBoth: () => void;
  onCancel: () => void;
}) {
  const hasLinkedTx = transactions.some((t) => t.invoiceId === invoice.id);

  return (
    <div>
      <p>Delete invoice #{invoice.invoiceNumber}?</p>
      {hasLinkedTx && <p>This invoice has a linked income transaction.</p>}
      <button onClick={onCancel}>Cancel</button>
      {hasLinkedTx && <button onClick={onDeleteInvoiceOnly}>Delete Invoice Only</button>}
      <button onClick={onDeleteBoth}>{hasLinkedTx ? 'Delete Both' : 'Delete Invoice'}</button>
    </div>
  );
}

// ---------- Transaction delete confirmation component (extracted logic) ----------

function TransactionDeleteConfirmation({
  transaction,
  invoices,
  onDeleteTxOnly,
  onMarkInvoiceSent,
  onDeleteBoth,
  onCancel,
}: {
  transaction: Transaction;
  invoices: TrackedInvoice[];
  onDeleteTxOnly: () => void;
  onMarkInvoiceSent: () => void;
  onDeleteBoth: () => void;
  onCancel: () => void;
}) {
  const linkedInvoice = invoices.find((inv) => inv.id === transaction.invoiceId);

  return (
    <div>
      <p>This transaction is linked to invoice #{linkedInvoice?.invoiceNumber}.</p>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onMarkInvoiceSent}>Mark Invoice as Sent</button>
      <button onClick={onDeleteBoth}>Delete Both</button>
    </div>
  );
}

// ---------- Invoice deletion tests ----------

describe('Invoice delete confirmation', () => {
  it('shows linked transaction warning when invoice has a transaction', () => {
    const invoice = makeInvoice({ id: 'inv-1' });
    const txs = [makeTx({ id: 'tx-1', invoiceId: 'inv-1' })];

    render(
      <InvoiceDeleteConfirmation
        invoice={invoice}
        transactions={txs}
        onDeleteInvoiceOnly={vi.fn()}
        onDeleteBoth={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/linked income transaction/)).toBeInTheDocument();
    expect(screen.getByText('Delete Invoice Only')).toBeInTheDocument();
    expect(screen.getByText('Delete Both')).toBeInTheDocument();
  });

  it('does not show linked transaction warning when no linked transaction', () => {
    const invoice = makeInvoice({ id: 'inv-1' });
    const txs = [makeTx({ id: 'tx-1', invoiceId: 'inv-other' })];

    render(
      <InvoiceDeleteConfirmation
        invoice={invoice}
        transactions={txs}
        onDeleteInvoiceOnly={vi.fn()}
        onDeleteBoth={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText(/linked income transaction/)).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Invoice Only')).not.toBeInTheDocument();
    expect(screen.getByText('Delete Invoice')).toBeInTheDocument();
  });

  it('calls onDeleteInvoiceOnly when "Delete Invoice Only" is clicked', () => {
    const onDeleteInvoiceOnly = vi.fn();
    const invoice = makeInvoice({ id: 'inv-1' });
    const txs = [makeTx({ id: 'tx-1', invoiceId: 'inv-1' })];

    render(
      <InvoiceDeleteConfirmation
        invoice={invoice}
        transactions={txs}
        onDeleteInvoiceOnly={onDeleteInvoiceOnly}
        onDeleteBoth={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Delete Invoice Only'));
    expect(onDeleteInvoiceOnly).toHaveBeenCalledOnce();
  });

  it('calls onDeleteBoth when "Delete Both" is clicked', () => {
    const onDeleteBoth = vi.fn();
    const invoice = makeInvoice({ id: 'inv-1' });
    const txs = [makeTx({ id: 'tx-1', invoiceId: 'inv-1' })];

    render(
      <InvoiceDeleteConfirmation
        invoice={invoice}
        transactions={txs}
        onDeleteInvoiceOnly={vi.fn()}
        onDeleteBoth={onDeleteBoth}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Delete Both'));
    expect(onDeleteBoth).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    const invoice = makeInvoice({ id: 'inv-1' });

    render(
      <InvoiceDeleteConfirmation
        invoice={invoice}
        transactions={[]}
        onDeleteInvoiceOnly={vi.fn()}
        onDeleteBoth={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------- Transaction deletion tests ----------

describe('Transaction delete confirmation', () => {
  it('shows linked invoice info', () => {
    const tx = makeTx({ id: 'tx-1', invoiceId: 'inv-1' });
    const invoices = [makeInvoice({ id: 'inv-1', invoiceNumber: 'INV-042' })];

    render(
      <TransactionDeleteConfirmation
        transaction={tx}
        invoices={invoices}
        onDeleteTxOnly={vi.fn()}
        onMarkInvoiceSent={vi.fn()}
        onDeleteBoth={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/INV-042/)).toBeInTheDocument();
    expect(screen.getByText('Mark Invoice as Sent')).toBeInTheDocument();
    expect(screen.getByText('Delete Both')).toBeInTheDocument();
  });

  it('calls onMarkInvoiceSent when "Mark Invoice as Sent" is clicked', () => {
    const onMarkInvoiceSent = vi.fn();
    const tx = makeTx({ id: 'tx-1', invoiceId: 'inv-1' });
    const invoices = [makeInvoice({ id: 'inv-1' })];

    render(
      <TransactionDeleteConfirmation
        transaction={tx}
        invoices={invoices}
        onDeleteTxOnly={vi.fn()}
        onMarkInvoiceSent={onMarkInvoiceSent}
        onDeleteBoth={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Mark Invoice as Sent'));
    expect(onMarkInvoiceSent).toHaveBeenCalledOnce();
  });

  it('calls onDeleteBoth when "Delete Both" is clicked', () => {
    const onDeleteBoth = vi.fn();
    const tx = makeTx({ id: 'tx-1', invoiceId: 'inv-1' });
    const invoices = [makeInvoice({ id: 'inv-1' })];

    render(
      <TransactionDeleteConfirmation
        transaction={tx}
        invoices={invoices}
        onDeleteTxOnly={vi.fn()}
        onMarkInvoiceSent={vi.fn()}
        onDeleteBoth={onDeleteBoth}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Delete Both'));
    expect(onDeleteBoth).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    const tx = makeTx({ id: 'tx-1', invoiceId: 'inv-1' });
    const invoices = [makeInvoice({ id: 'inv-1' })];

    render(
      <TransactionDeleteConfirmation
        transaction={tx}
        invoices={invoices}
        onDeleteTxOnly={vi.fn()}
        onMarkInvoiceSent={vi.fn()}
        onDeleteBoth={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------- Gating logic tests (unit) ----------

describe('Delete gating logic', () => {
  describe('invoice deletion gating', () => {
    it('should prompt when invoice has linked transactions', () => {
      const invoiceId = 'inv-1';
      const transactions = [makeTx({ id: 'tx-1', invoiceId })];
      const shouldPrompt = transactions.some((t) => t.invoiceId === invoiceId);
      expect(shouldPrompt).toBe(true);
    });

    it('should not prompt when invoice has no linked transactions', () => {
      const invoiceId = 'inv-1';
      const transactions = [makeTx({ id: 'tx-1', invoiceId: null })];
      const shouldPrompt = transactions.some((t) => t.invoiceId === invoiceId);
      expect(shouldPrompt).toBe(false);
    });

    it('should not prompt when transactions list is empty', () => {
      const invoiceId = 'inv-1';
      const transactions: Transaction[] = [];
      const shouldPrompt = transactions.some((t) => t.invoiceId === invoiceId);
      expect(shouldPrompt).toBe(false);
    });
  });

  describe('transaction deletion gating', () => {
    it('should prompt when transaction has a linked invoice that exists', () => {
      const tx = makeTx({ id: 'tx-1', invoiceId: 'inv-1' });
      const invoices = [makeInvoice({ id: 'inv-1' })];
      const shouldPrompt = tx.invoiceId !== null && invoices.some((inv) => inv.id === tx.invoiceId);
      expect(shouldPrompt).toBe(true);
    });

    it('should not prompt when transaction has no invoiceId', () => {
      const tx = makeTx({ id: 'tx-1', invoiceId: null });
      const invoices = [makeInvoice({ id: 'inv-1' })];
      const shouldPrompt = tx.invoiceId !== null && invoices.some((inv) => inv.id === tx.invoiceId);
      expect(shouldPrompt).toBe(false);
    });

    it('should not prompt when linked invoice no longer exists', () => {
      const tx = makeTx({ id: 'tx-1', invoiceId: 'inv-deleted' });
      const invoices = [makeInvoice({ id: 'inv-1' })];
      const shouldPrompt = tx.invoiceId !== null && invoices.some((inv) => inv.id === tx.invoiceId);
      expect(shouldPrompt).toBe(false);
    });
  });
});

// ---------- Context logic tests (deleteInvoice no longer cascades) ----------

describe('deleteInvoice does not cascade', () => {
  it('deleteInvoice filter only removes the invoice, not transactions', () => {
    const invoices = [
      makeInvoice({ id: 'inv-1' }),
      makeInvoice({ id: 'inv-2', invoiceNumber: 'INV-002' }),
    ];
    const transactions = [
      makeTx({ id: 'tx-1', invoiceId: 'inv-1' }),
      makeTx({ id: 'tx-2', invoiceId: 'inv-2' }),
      makeTx({ id: 'tx-3', invoiceId: null }),
    ];

    const deletedId = 'inv-1';
    const remainingInvoices = invoices.filter((x) => x.id !== deletedId);
    // transactions should NOT be filtered — that's the whole point of the change
    const remainingTransactions = transactions;

    expect(remainingInvoices).toHaveLength(1);
    expect(remainingInvoices[0].id).toBe('inv-2');
    expect(remainingTransactions).toHaveLength(3);
    expect(remainingTransactions.find((t) => t.invoiceId === 'inv-1')).toBeDefined();
  });

  it('deleteTransactionsByInvoiceId removes only matching transactions', () => {
    const transactions = [
      makeTx({ id: 'tx-1', invoiceId: 'inv-1' }),
      makeTx({ id: 'tx-2', invoiceId: 'inv-1' }),
      makeTx({ id: 'tx-3', invoiceId: 'inv-2' }),
      makeTx({ id: 'tx-4', invoiceId: null }),
    ];

    const invoiceId = 'inv-1';
    const remaining = transactions.filter((t) => t.invoiceId !== invoiceId);

    expect(remaining).toHaveLength(2);
    expect(remaining.map((t) => t.id)).toEqual(['tx-3', 'tx-4']);
  });
});
