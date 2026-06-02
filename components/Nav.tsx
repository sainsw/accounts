'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/context';
import {
  primaryNavItems,
  secondaryNavItems,
  isNavItemActive,
  type NavItem,
} from './nav-shared';

export default function Nav() {
  const pathname = usePathname();
  const { settings } = useApp();

  const visible = (items: NavItem[]) =>
    items.filter((item) => !item.requiresVat || settings.vatRegistered);

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {visible(primaryNavItems).map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}

      <div className="my-2 border-t border-slate-200 dark:border-slate-700/60" />

      {visible(secondaryNavItems).map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const { href, label, icon: Icon } = item;
  const active = isNavItemActive(href, pathname);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
