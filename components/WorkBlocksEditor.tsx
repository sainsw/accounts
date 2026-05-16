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
import type { InvoiceWorkBlock } from '@/lib/types';
import { getWeekdays } from '@/lib/invoice-utils';

type Props = {
  blocks: InvoiceWorkBlock[];
  currencySymbol: string;
  inputCls: string;
  onChange: (id: string, patch: Partial<InvoiceWorkBlock>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
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

const iconBtn = (color: 'slate' | 'red') => {
  const base = 'inline-flex h-8 w-8 items-center justify-center rounded-lg transition';
  if (color === 'red') return `${base} text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400`;
  return `${base} text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200`;
};

const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);

const SortableDesktopRow = ({
  block, sym, inputCls, onChange, onRemove, onDuplicate, isLast,
  index, total, openMenuId, setOpenMenuId, onMoveUp, onMoveDown, flipRef,
}: {
  block: InvoiceWorkBlock; sym: string; inputCls: string;
  onChange: Props['onChange']; onRemove: Props['onRemove']; onDuplicate: Props['onDuplicate']; isLast: boolean;
} & RowExtras) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isOpen = openMenuId === block.id;
  const days = getWeekdays(block.startDate, block.endDate);
  const hasError = days <= 0 && block.startDate && block.endDate;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging || isOpen ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div
      ref={(el) => { setNodeRef(el); flipRef(el); }}
      style={style}
      className={`grid grid-cols-[1fr_140px_140px_50px_110px_110px_auto_auto] items-end gap-3 px-3 py-3 ${isLast ? '' : 'border-b border-slate-100 dark:border-slate-700'}`}
    >
      <div className="min-w-0">
        <input type="text" value={block.description} onChange={(e) => onChange(block.id, { description: e.target.value })}
          className={inputCls} placeholder="Service description" />
        {hasError && <p className="mt-1 text-xs text-red-500">End date must be after start date.</p>}
      </div>
      <div>
        <input type="date" value={block.startDate} onChange={(e) => onChange(block.id, { startDate: e.target.value })} className={inputCls} />
      </div>
      <div>
        <input type="date" value={block.endDate} onChange={(e) => onChange(block.id, { endDate: e.target.value })} className={inputCls} />
      </div>
      <div className="py-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
        {days > 0 ? days : '—'}
      </div>
      <div>
        <input type="number" step="0.01" min="0" value={block.dailyRate || ''} onChange={(e) => onChange(block.id, { dailyRate: parseFloat(e.target.value) || 0 })} className={inputCls} />
      </div>
      <div>
        <input type="number" step="0.01" min="0" value={block.blockTotal || ''} onChange={(e) => onChange(block.id, { blockTotal: parseFloat(e.target.value) || 0 })} className={inputCls} />
      </div>
      <div className="flex items-center gap-0.5">
        <button type="button" aria-label="Duplicate" className={iconBtn('slate')} onClick={() => onDuplicate(block.id)}><CopyIcon /></button>
        <button type="button" aria-label="Remove" className={iconBtn('red')} onClick={() => onRemove(block.id)}><TrashIcon /></button>
      </div>
      <div className="relative flex items-center justify-center">
        <button ref={toggleRef} type="button" className={dragHandleClass}
          aria-label="Drag to reorder" onClick={() => setOpenMenuId(isOpen ? null : block.id)}
          {...attributes} {...listeners}>
          <GripIcon />
        </button>
        {isOpen && (
          <ReorderCallout canMoveUp={index > 0} canMoveDown={index < total - 1}
            onMoveUp={() => { onMoveUp(block.id); setOpenMenuId(null); }}
            onMoveDown={() => { onMoveDown(block.id); setOpenMenuId(null); }}
            onClose={() => setOpenMenuId(null)} toggleRef={toggleRef} placement="desktop" />
        )}
      </div>
    </div>
  );
};

const SortableCard = ({
  block, sym, inputCls, onChange, onRemove, onDuplicate,
  index, total, openMenuId, setOpenMenuId, onMoveUp, onMoveDown, flipRef,
}: {
  block: InvoiceWorkBlock; sym: string; inputCls: string;
  onChange: Props['onChange']; onRemove: Props['onRemove']; onDuplicate: Props['onDuplicate'];
} & RowExtras) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isOpen = openMenuId === block.id;
  const days = getWeekdays(block.startDate, block.endDate);
  const hasError = days <= 0 && block.startDate && block.endDate;
  const lineTotal = block.billingMode === 'daily' ? days * block.dailyRate : block.blockTotal;

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
            aria-label="Drag to reorder" onClick={() => setOpenMenuId(isOpen ? null : block.id)}
            {...attributes} {...listeners}>
            <GripIcon />
          </button>
          {isOpen && (
            <ReorderCallout canMoveUp={index > 0} canMoveDown={index < total - 1}
              onMoveUp={() => { onMoveUp(block.id); setOpenMenuId(null); }}
              onMoveDown={() => { onMoveDown(block.id); setOpenMenuId(null); }}
              onClose={() => setOpenMenuId(null)} toggleRef={toggleRef} placement="mobile" />
          )}
        </div>
        <span className="text-xs text-slate-400">Drag to reorder</span>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
        <input type="text" value={block.description} onChange={(e) => onChange(block.id, { description: e.target.value })}
          className={inputCls} placeholder="Service description" />
        {hasError && <p className="mt-1 text-xs text-red-500">End date must be after start date.</p>}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Start</span>
          <input type="date" value={block.startDate} onChange={(e) => onChange(block.id, { startDate: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">End</span>
          <input type="date" value={block.endDate} onChange={(e) => onChange(block.id, { endDate: e.target.value })} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Rate ({sym})</span>
          <input type="number" step="0.01" min="0" value={block.dailyRate || ''} onChange={(e) => onChange(block.id, { dailyRate: parseFloat(e.target.value) || 0 })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total ({sym})</span>
          <input type="number" step="0.01" min="0" value={block.blockTotal || ''} onChange={(e) => onChange(block.id, { blockTotal: parseFloat(e.target.value) || 0 })} className={inputCls} />
        </label>
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Days</span>
          <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {days > 0 ? days : '—'}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:bg-slate-700 dark:text-white">
        <span>Line total</span>
        <span>{sym}{lineTotal > 0 ? lineTotal.toFixed(2) : '0.00'}</span>
      </div>
      <div className="flex gap-1">
        <button type="button" aria-label="Duplicate" className={iconBtn('slate')} onClick={() => onDuplicate(block.id)}><CopyIcon /></button>
        <button type="button" aria-label="Remove" className={iconBtn('red')} onClick={() => onRemove(block.id)}><TrashIcon /></button>
      </div>
    </div>
  );
};

const useDragSensors = () =>
  useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

const buildDragEnd = (blocks: InvoiceWorkBlock[], onReorder: Props['onReorder']) => (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIdx = blocks.findIndex((b) => b.id === active.id);
  const newIdx = blocks.findIndex((b) => b.id === over.id);
  if (oldIdx < 0 || newIdx < 0) return;
  onReorder(arrayMove(blocks, oldIdx, newIdx).map((b) => b.id));
};

export const WorkBlocksEditor = (props: Props) => {
  const { blocks, currencySymbol: sym, inputCls, onChange, onRemove, onDuplicate, onReorder } = props;
  const sensors = useDragSensors();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { arm, registerRef } = useReorderAnimation();
  const ids = blocks.map((b) => b.id);

  const moveBy = (id: string, delta: number) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    arm();
    onReorder(arrayMove(blocks, idx, newIdx).map((b) => b.id));
  };

  const headerClass = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <div>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block dark:border-slate-700 dark:bg-slate-800">
        <DndContext sensors={sensors} collisionDetection={closestCenterExcludingActive}
          onDragStart={() => setOpenMenuId(null)} onDragEnd={buildDragEnd(blocks, onReorder)}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[1fr_140px_140px_50px_110px_110px_auto_auto] gap-3 border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className={headerClass}>Description</div>
                <div className={headerClass}>Start</div>
                <div className={headerClass}>End</div>
                <div className={headerClass}>Days</div>
                <div className={headerClass}>Rate ({sym})</div>
                <div className={headerClass}>Total ({sym})</div>
                <div className={headerClass} aria-label="Actions" />
                <div className="w-8" />
              </div>
              {blocks.map((block, i) => (
                <SortableDesktopRow key={block.id} block={block} sym={sym} inputCls={inputCls}
                  onChange={onChange} onRemove={onRemove} onDuplicate={onDuplicate}
                  isLast={i === blocks.length - 1}
                  index={i} total={blocks.length} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
                  onMoveUp={(id) => moveBy(id, -1)} onMoveDown={(id) => moveBy(id, 1)}
                  flipRef={registerRef(block.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenterExcludingActive}
          onDragStart={() => setOpenMenuId(null)} onDragEnd={buildDragEnd(blocks, onReorder)}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {blocks.map((block, i) => (
              <SortableCard key={block.id} block={block} sym={sym} inputCls={inputCls}
                onChange={onChange} onRemove={onRemove} onDuplicate={onDuplicate}
                index={i} total={blocks.length} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
                onMoveUp={(id) => moveBy(id, -1)} onMoveDown={(id) => moveBy(id, 1)}
                flipRef={registerRef(block.id)} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
