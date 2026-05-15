import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ParsedInvoice } from '../../lib/pdf-import';

vi.mock('@/lib/pdf-import', () => ({
  parseInvoicePdfs: vi.fn(),
}));

import PdfImportWizard from '../../components/PdfImportWizard';
import { parseInvoicePdfs } from '@/lib/pdf-import';

const baseParsed: ParsedInvoice[] = [
  {
    fileName: 'INV-001.pdf',
    invoiceNumber: 'INV-001',
    clientName: 'Acme Corp',
    issueDate: '2024-06-01',
    amount: 1000,
    confidence: 'high',
  },
  {
    fileName: 'INV-002.pdf',
    invoiceNumber: 'INV-002',
    clientName: 'Beta Inc',
    issueDate: '2024-07-01',
    amount: 2000,
    confidence: 'medium',
  },
];

function makeFile(name: string): File {
  return new File(['dummy'], name, { type: 'application/pdf' });
}

describe('PdfImportWizard', () => {
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onComplete = vi.fn();
    vi.mocked(parseInvoicePdfs).mockReset();
    vi.mocked(parseInvoicePdfs).mockResolvedValue(baseParsed);
  });

  const defaultProps = {
    clients: [{ id: 'c-1', name: 'Acme Corp' }],
    existingInvoiceNumbers: [] as string[],
    onComplete: vi.fn(),
  };

  it('renders drop zone initially', () => {
    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);
    expect(screen.getByText('Drop invoice PDFs here')).toBeInTheDocument();
  });

  it('shows parsing spinner after files are dropped', async () => {
    // Make parseInvoicePdfs hang to catch the "parsing" state
    let resolve: (v: ParsedInvoice[]) => void;
    vi.mocked(parseInvoicePdfs).mockReturnValue(
      new Promise((r) => { resolve = r; })
    );

    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);

    // Simulate file input change
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('INV-001.pdf')] },
    });

    await waitFor(() => {
      expect(screen.getByText('Reading PDFs...')).toBeInTheDocument();
    });

    // Resolve to clean up
    resolve!(baseParsed);
  });

  it('displays parsed invoice data in review step', async () => {
    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('INV-001.pdf')] },
    });

    await waitFor(() => {
      expect(screen.getByText('Invoice 1 of 2')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('INV-001')).toBeInTheDocument();
    expect(screen.getByText('high confidence')).toBeInTheDocument();
  });

  it('shows duplicate warning when invoice number matches existing', async () => {
    render(
      <PdfImportWizard
        clients={defaultProps.clients}
        existingInvoiceNumbers={['INV-001']}
        onComplete={onComplete}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('INV-001.pdf')] },
    });

    await waitFor(() => {
      expect(screen.getByText(/already exists in your invoices/)).toBeInTheDocument();
    });
  });

  it('shows duplicate warning when invoice number matches earlier item in batch', async () => {
    // Two invoices with same number
    vi.mocked(parseInvoicePdfs).mockResolvedValue([
      { ...baseParsed[0], invoiceNumber: 'DUP-001' },
      { ...baseParsed[1], invoiceNumber: 'DUP-001' },
    ]);

    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.pdf'), makeFile('b.pdf')] },
    });

    await waitFor(() => {
      expect(screen.getByText('Invoice 1 of 2')).toBeInTheDocument();
    });

    // Confirm the first
    fireEvent.click(screen.getByText('Confirm & Next'));

    await waitFor(() => {
      expect(screen.getByText('Invoice 2 of 2')).toBeInTheDocument();
      expect(screen.getByText(/already confirmed in this batch/)).toBeInTheDocument();
    });
  });

  it('Skip button advances to next invoice', async () => {
    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.pdf'), makeFile('b.pdf')] },
    });

    await waitFor(() => screen.getByText('Invoice 1 of 2'));
    fireEvent.click(screen.getByText('Skip'));
    await waitFor(() => {
      expect(screen.getByText('Invoice 2 of 2')).toBeInTheDocument();
    });
  });

  it('Confirm button adds invoice to confirmed list and advances', async () => {
    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.pdf'), makeFile('b.pdf')] },
    });

    await waitFor(() => screen.getByText('Invoice 1 of 2'));
    expect(screen.getByText('0 confirmed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirm & Next'));
    await waitFor(() => {
      expect(screen.getByText('Invoice 2 of 2')).toBeInTheDocument();
      expect(screen.getByText('1 confirmed')).toBeInTheDocument();
    });
  });

  it('Back button unconfirms previous invoice', async () => {
    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.pdf'), makeFile('b.pdf')] },
    });

    await waitFor(() => screen.getByText('Invoice 1 of 2'));
    fireEvent.click(screen.getByText('Confirm & Next'));
    await waitFor(() => screen.getByText('Invoice 2 of 2'));
    expect(screen.getByText('1 confirmed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    await waitFor(() => {
      expect(screen.getByText('Invoice 1 of 2')).toBeInTheDocument();
      expect(screen.getByText('0 confirmed')).toBeInTheDocument();
    });
  });

  it('summary modal displays all confirmed invoices', async () => {
    vi.mocked(parseInvoicePdfs).mockResolvedValue([baseParsed[0]]);

    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.pdf')] },
    });

    await waitFor(() => screen.getByText('Invoice 1 of 1'));
    fireEvent.click(screen.getByText('Confirm & Finish'));

    await waitFor(() => {
      expect(screen.getByText('Import Summary')).toBeInTheDocument();
      expect(screen.getByText('1 invoice ready to import:')).toBeInTheDocument();
    });
  });

  it('remove button in summary removes invoice from confirmed list', async () => {
    vi.mocked(parseInvoicePdfs).mockResolvedValue([baseParsed[0]]);

    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.pdf')] },
    });

    await waitFor(() => screen.getByText('Invoice 1 of 1'));
    fireEvent.click(screen.getByText('Confirm & Finish'));

    await waitFor(() => screen.getByText('Import Summary'));
    // Click the remove button (trash icon button)
    const removeBtn = screen.getByTitle('Remove from import');
    fireEvent.click(removeBtn);
    await waitFor(() => {
      expect(screen.getByText('No invoices were confirmed for import.')).toBeInTheDocument();
    });
  });

  it('Cancel resets all state', async () => {
    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.pdf')] },
    });

    await waitFor(() => screen.getByText('Invoice 1 of 2'));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.getByText('Drop invoice PDFs here')).toBeInTheDocument();
    });
  });

  it('onComplete is called with confirmed invoices on final submit', async () => {
    vi.mocked(parseInvoicePdfs).mockResolvedValue([baseParsed[0]]);

    render(<PdfImportWizard {...defaultProps} onComplete={onComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.pdf')] },
    });

    await waitFor(() => screen.getByText('Invoice 1 of 1'));
    fireEvent.click(screen.getByText('Confirm & Finish'));

    await waitFor(() => screen.getByText('Import Summary'));
    fireEvent.click(screen.getByText(/Import 1 Invoice/));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0];
    expect(result).toHaveLength(1);
    expect(result[0].invoiceNumber).toBe('INV-001');
    expect(result[0].amount).toBe(1000);
  });
});
