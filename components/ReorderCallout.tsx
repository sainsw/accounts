'use client';

import { RefObject, useEffect, useRef } from 'react';

type Placement = 'desktop' | 'mobile';

type Props = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
  toggleRef: RefObject<HTMLElement | null>;
  placement: Placement;
};

const placementClass: Record<Placement, string> = {
  desktop: 'right-0 top-full mt-2',
  mobile: 'left-0 top-full mt-2',
};

const itemClass =
  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800';

export const ReorderCallout = ({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onClose,
  toggleRef,
  placement,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      onClose();
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose, toggleRef]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Reorder options"
      className={`absolute z-30 flex w-40 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-800 ${placementClass[placement]}`}
    >
      <button type="button" role="menuitem" disabled={!canMoveUp} onClick={onMoveUp} className={itemClass}>
        <span aria-hidden>↑</span> Move up
      </button>
      <button type="button" role="menuitem" disabled={!canMoveDown} onClick={onMoveDown} className={itemClass}>
        <span aria-hidden>↓</span> Move down
      </button>
    </div>
  );
};
