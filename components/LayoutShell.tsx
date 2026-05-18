'use client';

import type { ReactNode } from 'react';
import { UndoProvider } from '@/lib/undo-context';

export function LayoutShell({ children }: { children: ReactNode }) {
  return <UndoProvider>{children}</UndoProvider>;
}
