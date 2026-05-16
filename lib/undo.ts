'use client';

import { useState, useCallback, useMemo } from 'react';

export type UndoEntry = {
  description: string;
  undo: () => void;
  redo: () => void;
};

export type UndoStack = {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  push: (entry: UndoEntry) => void;
  undo: () => void;
  redo: () => void;
};

export function useUndoStack(maxSize: number = 50): UndoStack {
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  const push = useCallback(
    (entry: UndoEntry) => {
      setUndoStack((prev) => {
        const next = [...prev, entry];
        if (next.length > maxSize) {
          return next.slice(next.length - maxSize);
        }
        return next;
      });
      setRedoStack([]);
    },
    [maxSize]
  );

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      entry.undo();
      setRedoStack((r) => [...r, entry]);
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      entry.redo();
      setUndoStack((u) => [...u, entry]);
      return prev.slice(0, -1);
    });
  }, []);

  return useMemo(
    () => ({
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoDescription: undoStack.length > 0 ? undoStack[undoStack.length - 1].description : null,
      redoDescription: redoStack.length > 0 ? redoStack[redoStack.length - 1].description : null,
      push,
      undo,
      redo,
    }),
    [undoStack, redoStack, push, undo, redo]
  );
}
