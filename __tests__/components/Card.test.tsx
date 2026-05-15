import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, PageHeader, EmptyState, StatCard } from '../../components/Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>Card content</p></Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="my-custom-class"><p>Content</p></Card>);
    expect(container.firstElementChild!.className).toContain('my-custom-class');
  });
});

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="My Title" description="My description" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My description')).toBeInTheDocument();
  });

  it('renders action slot content', () => {
    render(
      <PageHeader title="Title" actions={<button>Action Button</button>} />
    );
    expect(screen.getByText('Action Button')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders icon, title, and description', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">Icon</span>}
        title="Empty Title"
        description="Empty Description"
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Empty Title')).toBeInTheDocument();
    expect(screen.getByText('Empty Description')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    render(
      <EmptyState
        title="Title"
        description="Desc"
        action={<button>Do something</button>}
      />
    );
    expect(screen.getByText('Do something')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Revenue" value="$1,000" />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$1,000')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatCard label="Revenue" value="$1,000" sub="Up 10%" />);
    expect(screen.getByText('Up 10%')).toBeInTheDocument();
  });

  it('applies correct color variant class for green', () => {
    render(<StatCard label="Income" value="$500" color="green" />);
    const valueEl = screen.getByText('$500');
    expect(valueEl.className).toContain('text-emerald-600');
  });

  it('applies correct color variant class for red', () => {
    render(<StatCard label="Costs" value="$200" color="red" />);
    const valueEl = screen.getByText('$200');
    expect(valueEl.className).toContain('text-red-600');
  });

  it('applies correct color variant class for blue', () => {
    render(<StatCard label="Outstanding" value="$300" color="blue" />);
    const valueEl = screen.getByText('$300');
    expect(valueEl.className).toContain('text-brand-600');
  });
});
