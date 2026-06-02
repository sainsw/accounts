import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockPathname = vi.fn(() => '/');

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(() => ({
    settings: { vatRegistered: false },
  })),
}));

import Nav from '../../components/Nav';
import { useApp } from '@/lib/context';

describe('Nav', () => {
  it('renders all base navigation links', () => {
    render(<Nav />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Money in & out')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('does not render VAT link when vatRegistered is false', () => {
    vi.mocked(useApp).mockReturnValue({
      settings: { vatRegistered: false },
    } as any);
    render(<Nav />);
    expect(screen.queryByText('VAT')).not.toBeInTheDocument();
  });

  it('renders VAT link when vatRegistered is true', () => {
    vi.mocked(useApp).mockReturnValue({
      settings: { vatRegistered: true },
    } as any);
    render(<Nav />);
    expect(screen.getByText('VAT')).toBeInTheDocument();
  });

  it('highlights the active link matching current pathname', () => {
    mockPathname.mockReturnValue('/transactions');
    vi.mocked(useApp).mockReturnValue({
      settings: { vatRegistered: false },
    } as any);
    render(<Nav />);
    const txLink = screen.getByText('Money in & out').closest('a');
    expect(txLink!.className).toContain('bg-brand-50');
    // Home should not be active
    const dashLink = screen.getByText('Home').closest('a');
    expect(dashLink!.className).not.toContain('bg-brand-50');
  });

  it('links navigate to correct paths', () => {
    vi.mocked(useApp).mockReturnValue({
      settings: { vatRegistered: true },
    } as any);
    mockPathname.mockReturnValue('/');
    render(<Nav />);
    expect(screen.getByText('Home').closest('a')).toHaveAttribute('href', '/');
    expect(screen.getByText('Money in & out').closest('a')).toHaveAttribute('href', '/transactions');
    expect(screen.getByText('Clients').closest('a')).toHaveAttribute('href', '/clients');
    expect(screen.getByText('Invoices').closest('a')).toHaveAttribute('href', '/invoices');
    expect(screen.getByText('VAT').closest('a')).toHaveAttribute('href', '/vat');
    expect(screen.getByText('Reports').closest('a')).toHaveAttribute('href', '/reports');
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings');
  });
});
