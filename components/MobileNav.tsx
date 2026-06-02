'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/context';
import NewMenu from './NewMenu';
import {
  mobileTabItems,
  mobileMoreItems,
  isNavItemActive,
  MoreIcon,
  type NavItem,
} from './nav-shared';

export default function MobileNav() {
  const pathname = usePathname();
  const { settings } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet whenever the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const moreItems = mobileMoreItems.filter(
    (item) => !item.requiresVat || settings.vatRegistered
  );
  const moreActive = moreItems.some((item) => isNavItemActive(item.href, pathname));

  // Money + Invoices sit either side of the centre "+" button.
  const [home, money, invoices] = mobileTabItems;

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur print:hidden dark:border-slate-700/60 dark:bg-slate-900/95 lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          <TabLink item={home} pathname={pathname} />
          <TabLink item={money} pathname={pathname} />
          <div className="flex items-center justify-center px-1">
            <NewMenu variant="fab" />
          </div>
          <TabLink item={invoices} pathname={pathname} />
          <button
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
              moreActive
                ? 'text-brand-600 dark:text-brand-300'
                : 'text-slate-500 dark:text-slate-400'
            )}
          >
            <MoreIcon className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More navigation">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-2xl dark:bg-slate-800">
            <div className="mx-auto mb-2 mt-1 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              More
            </p>
            {moreItems.map(({ href, label, icon: Icon }) => {
              const active = isNavItemActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function TabLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const { href, label, short, icon: Icon } = item;
  const active = isNavItemActive(href, pathname);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
        active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'
      )}
    >
      <Icon className="h-5 w-5" />
      {short ?? label}
    </Link>
  );
}
