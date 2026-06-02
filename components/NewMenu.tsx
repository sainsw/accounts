'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createActions, PlusIcon } from './nav-shared';

type Variant = 'sidebar' | 'fab';

export default function NewMenu({ variant }: { variant: Variant }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div ref={ref} className={cn('relative', variant === 'fab' && 'flex flex-col items-center')}>
      {variant === 'sidebar' ? (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <PlusIcon className="h-5 w-5" />
          New
        </button>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Create new"
          aria-expanded={open}
          aria-haspopup="menu"
          className={cn(
            'flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg ring-4 ring-white transition-transform active:scale-95 dark:ring-slate-900',
            open && 'rotate-45'
          )}
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800',
            variant === 'sidebar'
              ? 'left-0 top-full mt-2'
              : 'bottom-full left-1/2 mb-3 -translate-x-1/2'
          )}
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Create
          </p>
          {createActions.map(({ label, description, href, icon: Icon }) => (
            <button
              key={href}
              role="menuitem"
              onClick={() => go(href)}
              className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/60"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
