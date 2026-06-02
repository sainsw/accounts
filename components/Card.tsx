import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80',
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-16 text-center dark:border-slate-700">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: 'green' | 'red' | 'blue' | 'default';
}) {
  const valueColor = {
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-brand-600 dark:text-brand-400',
    default: 'text-slate-900 dark:text-slate-100',
  }[color ?? 'default'];

  return (
    <Card>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-bold tracking-tight', valueColor)}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>
      )}
    </Card>
  );
}
