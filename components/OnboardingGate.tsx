'use client';

import { useApp } from '@/lib/context';
import SetupWizard from './SetupWizard';

export default function OnboardingGate() {
  const { ready, onboardingDone, completeOnboarding } = useApp();

  if (!ready || onboardingDone) return null;

  return <SetupWizard onComplete={completeOnboarding} />;
}
