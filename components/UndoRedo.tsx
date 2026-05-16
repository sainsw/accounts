'use client';

import { useEffect } from 'react';
import { UndoStack } from '@/lib/undo';

export function UndoRedo({ undoStack }: { undoStack: UndoStack }) {
  const { canUndo, canRedo, undoDescription, redoDescription, undo, redo } = undoStack;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  if (!canUndo && !canRedo) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-lg bg-white p-1 shadow-lg ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
      <button
        onClick={undo}
        disabled={!canUndo}
        title={undoDescription ? `Undo: ${undoDescription}` : 'Nothing to undo'}
        className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M7.793 2.232a.75.75 0 0 1-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 0 1 0 10.75H10.75a.75.75 0 0 1 0-1.5h2.875a3.875 3.875 0 0 0 0-7.75H3.622l4.146 3.957a.75.75 0 0 1-1.036 1.085l-5.5-5.25a.75.75 0 0 1 0-1.085l5.5-5.25a.75.75 0 0 1 1.06.025Z"
            clipRule="evenodd"
          />
        </svg>
        <span className="hidden sm:inline">Undo</span>
        <kbd className="ml-1 hidden rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 sm:inline">
          ⌘Z
        </kbd>
      </button>

      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-600" />

      <button
        onClick={redo}
        disabled={!canRedo}
        title={redoDescription ? `Redo: ${redoDescription}` : 'Nothing to redo'}
        className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <span className="hidden sm:inline">Redo</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M12.207 2.232a.75.75 0 0 1 .025 1.06l4.146 3.958H6.375a5.375 5.375 0 0 0 0 10.75H9.25a.75.75 0 0 1 0-1.5H6.375a3.875 3.875 0 0 1 0-7.75h10.003l-4.146 3.957a.75.75 0 0 1 1.036 1.085l5.5-5.25a.75.75 0 0 1 0-1.085l-5.5-5.25a.75.75 0 0 1-1.06.025Z"
            clipRule="evenodd"
          />
        </svg>
        <kbd className="ml-1 hidden rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 sm:inline">
          ⌘⇧Z
        </kbd>
      </button>
    </div>
  );
}
