'use client';

import { CSSProperties, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { closestCenterExcludingActive } from '@/lib/dnd';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ReorderCallout } from '@/components/ReorderCallout';
import { useReorderAnimation } from '@/hooks/useReorderAnimation';
import type { InvoiceExpense } from '@/lib/types';

type Props = {
  expenses: InvoiceExpense[];
  currencySymbol: string;
  inputCls: string;
  onChange: (id: string, patch: Partial<InvoiceExpense>) => void;
  onRemove: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
};

type RowExtras = {
  index: number;
  total: number;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  flipRef: (el: HTMLElement | null) => void;
};

const GripIcon = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="4" cy="3" r="1.2" fill="currentColor" />
    <circle cx="10" cy="3" r="1.2" fill="currentColor" />
    <circle cx="4" cy="7" r="1.2" fill="currentColor" />
    <circle cx="10" cy="7" r="1.2" fill="currentColor" />
    <circle cx="4" cy="11" r="1.2" fill="currentColor" />
    <circle cx="10" cy="11" r="1.2" fill="currentColor" />
  </svg>
);

const dragHandleClass =
  'inline-flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-100';

const pillBtn =
  'inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20';

const SortableDesktopRow = ({
  expense, inputCls, onChange, onRemove, isLast,
  index, total, openMenuId, setOpenMenuId, onMoveUp, onMoveDown, flipRef,
}: {
  expense: InvoiceExpense; inputCls: string;
  onChange: Props['onChange']; onRemove: Props['onRemove']; isLast: boolean;
} & RowExtras) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: expense.id });
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isOpen = openMenuId === expense.id;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging || isOpen ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div ref={(el) => { setNodeRef(el); flipRef(el); }} style={style}
      className={`grid grid-cols-[140px_1fr_120px_auto_auto] items-end gap-3 px-3 py-3 ${isLast ? '' : 'border-b border-slate-100 dark:border-slate-700'}`}>
      <div>
        <input type="date" value={expense.date} onChange={(e) => onChange(expense.id, { date: e.target.value })} className={inputCls} />
      </div>
      <div className="min-w-0">
        <input type="text" value={expense.notes} onChange={(e) => onChange(expense.id, { notes: e.target.value })}
          className={inputCls} placeholder="Expense description" />
      </div>
      <div>
        <input type="number" step="0.01" min="0" value={expense.amount || ''} onChange={(e) => onChange(expense.id, { amount: parseFloat(e.target.value) || 0 })} className={inputCls} />
      </div>
      <div>
        <button type="button" className={pillBtn} onClick={() => onRemove(expense.id)}>Remove</button>
      </div>
      <div className="relative flex items-center justify-center">
        <button ref={toggleRef} type="button" className={dragHandleClass}
          aria-label="Drag to reorder" onClick={() => setOpenMenuId(isOpen ? null : expense.id)}
          {...attributes} {...listeners}>
          <GripIcon />
        </button>
        {isOpen && (
          <ReorderCallout canMoveUp={index > 0} canMoveDown={index < total - 1}
            onMoveUp={() => { onMoveUp(expense.id); setOpenMenuId(null); }}
            onMoveDown={() => { onMoveDown(expense.id); setOpenMenuId(null); }}
            onClose={() => setOpenMenuId(null)} toggleRef={toggleRef} placement="desktop" />
        )}
      </div>
    </div>
  );
};

const SortableCard = ({
  expense, sym, inputCls, onChange, onRemove,
  index, total, openMenuId, setOpenMenuId, onMoveUp, onMoveDown, flipRef,
}: {
  expense: InvoiceExpense; sym: string; inputCls: string;
  onChange: Props['onChange']; onRemove: Props['onRemove'];
} & RowExtras) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: expense.id });
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isOpen = openMenuId === expense.id;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging || isOpen ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div ref={(el) => { setNodeRef(el); flipRef(el); }} style={style}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <div className="relative">
          <button ref={toggleRef} type="button" className={dragHandleClass}
            aria-label="Drag to reorder" onClick={() => setOpenMenuId(isOpen ? null : expense.id)}
            {...attributes} {...listeners}>
            <GripIcon />
          </button>
          {isOpen && (
            <ReorderCallout canMoveUp={index > 0} canMoveDown={index < total - 1}
              onMoveUp={() => { onMoveUp(expense.id); setOpenMenuId(null); }}
              onMoveDown={() => { onMoveDown(expense.id); setOpenMenuId(null); }}
              onClose={() => setOpenMenuId(null)} toggleRef={toggleRef} placement="mobile" />
          )}
        </div>
        <span className="text-xs text-slate-400">Drag to reorder</span>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date</span>
        <input type="date" value={expense.date} onChange={(e) => onChange(expense.id, { date: e.target.value })} className={inputCls} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</span>
        <input type="text" value={expense.notes} onChange={(e) => onChange(expense.id, { notes: e.target.value })}
          className={inputCls} placeholder="Expense description" />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount ({sym})</span>
        <input type="number" step="0.01" min="0" value={expense.amount || ''} onChange={(e) => onChange(expense.id, { amount: parseFloat(e.target.value) || 0 })} className={inputCls} />
      </label>
      <div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:bg-slate-700 dark:text-white">
        <span>Amount</span>
        <span>{sym}{expense.amount > 0 ? expense.amount.toFixed(2) : '0.00'}</span>
      </div>
      <button type="button" className={pillBtn} onClick={() => onRemove(expense.id)}>Remove</button>
    </div>
  );
};

const useDragSensors = () =>
  useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

const buildDragEnd = (expenses: InvoiceExpense[], onReorder: Props['onReorder']) => (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIdx = expenses.findIndex((e) => e.id === active.id);
  const newIdx = expenses.findIndex((e) => e.id === over.id);
  if (oldIdx < 0 || newIdx < 0) return;
  onReorder(arrayMove(expenses, oldIdx, newIdx).map((e) => e.id));
};

export const ExpensesEditor = (props: Props) => {
  const { expenses, currencySymbol: sym, inputCls, onChange, onRemove, onReorder } = props;
  const sensors = useDragSensors();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { arm, registerRef } = useReorderAnimation();
  const ids = expenses.map((e) => e.id);

  if (expenses.length === 0) return null;

  const moveBy = (id: string, delta: number) => {
    const idx = expenses.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= expenses.length) return;
    arm();
    onReorder(arrayMove(expenses, idx, newIdx).map((e) => e.id));
  };

  const headerClass = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <div>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block dark:border-slate-700 dark:bg-slate-800">
        <DndContext sensors={sensors} collisionDetection={closestCenterExcludingActive}
          onDragStart={() => setOpenMenuId(null)} onDragEnd={buildDragEnd(expenses, onReorder)}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[140px_1fr_120px_auto_auto] gap-3 border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className={headerClass}>Date</div>
                <div className={headerClass}>Notes</div>
                <div className={headerClass}>Amount ({sym})</div>
                <div className={headerClass} aria-label="Actions" />
                <div className="w-8" />
              </div>
              {expenses.map((expense, i) => (
                <SortableDesktopRow key={expense.id} expense={expense} inputCls={inputCls}
                  onChange={onChange} onRemove={onRemove}
                  isLast={i === expenses.length - 1}
                  index={i} total={expenses.length} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
                  onMoveUp={(id) => moveBy(id, -1)} onMoveDown={(id) => moveBy(id, 1)}
                  flipRef={registerRef(expense.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenterExcludingActive}
          onDragStart={() => setOpenMenuId(null)} onDragEnd={buildDragEnd(expenses, onReorder)}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {expenses.map((expense, i) => (
              <SortableCard key={expense.id} expense={expense} sym={sym} inputCls={inputCls}
                onChange={onChange} onRemove={onRemove}
                index={i} total={expenses.length} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
                onMoveUp={(id) => moveBy(id, -1)} onMoveDown={(id) => moveBy(id, 1)}
                flipRef={registerRef(expense.id)} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
