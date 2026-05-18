'use client';

import { type ReactNode, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { UndoProvider } from '@/lib/undo-context';

function HighContrastToggle() {
  const { settings } = useApp();
  useEffect(() => {
    if (settings.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [settings.highContrast]);
  return null;
}

export function LayoutShell({ children }: { children: ReactNode }) {
  return (
    <UndoProvider>
      <HighContrastToggle />
      {children}
    </UndoProvider>
  );
}
