import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('@/components/SetupWizard', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="setup-wizard">
      <button onClick={onComplete}>Finish Wizard</button>
    </div>
  ),
}));

import OnboardingGate from '../../components/OnboardingGate';
import { useApp } from '@/lib/context';

describe('OnboardingGate', () => {
  it('shows SetupWizard when onboarding is not done and app is ready', () => {
    const completeOnboarding = vi.fn();
    vi.mocked(useApp).mockReturnValue({
      ready: true,
      onboardingDone: false,
      completeOnboarding,
    } as any);

    render(<OnboardingGate />);
    expect(screen.getByTestId('setup-wizard')).toBeInTheDocument();
  });

  it('renders nothing when onboarding is complete', () => {
    vi.mocked(useApp).mockReturnValue({
      ready: true,
      onboardingDone: true,
      completeOnboarding: vi.fn(),
    } as any);

    const { container } = render(<OnboardingGate />);
    expect(container.innerHTML).toBe('');
  });

  it('calls completeOnboarding when wizard finishes', () => {
    const completeOnboarding = vi.fn();
    vi.mocked(useApp).mockReturnValue({
      ready: true,
      onboardingDone: false,
      completeOnboarding,
    } as any);

    render(<OnboardingGate />);
    fireEvent.click(screen.getByText('Finish Wizard'));
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });
});
