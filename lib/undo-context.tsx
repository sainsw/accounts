'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useUndoStack, type UndoStack } from './undo';
import { UndoRedo } from '@/components/UndoRedo';

const UndoContext = createContext<UndoStack | null>(null);

export function useUndo(): UndoStack {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const undoStack = useUndoStack(50);

  return (
    <UndoContext value={undoStack}>
      {children}
      <UndoRedo undoStack={undoStack} />
    </UndoContext>
  );
}
