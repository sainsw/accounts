import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import MobileNav from '@/components/MobileNav';
import NewMenu from '@/components/NewMenu';
import OnboardingGate from '@/components/OnboardingGate';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import { BrandMark } from '@/components/nav-shared';
import { AppProvider } from '@/lib/context';
import { LayoutShell } from '@/components/LayoutShell';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'Accounts',
  description: 'Free local-first accounting for sole traders and small businesses',
  manifest: '/manifest.json',
  themeColor: '#6366f1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Accounts',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex h-full font-sans">
        <AppProvider>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg">
            Skip to content
          </a>
          <OnboardingGate />
          <ServiceWorkerRegistration />

          {/* Desktop sidebar */}
          <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 print:hidden dark:border-slate-700/60 dark:bg-slate-900 lg:flex" aria-label="Main navigation">
            <div className="mb-5 px-2">
              <BrandMark />
            </div>
            <div className="mb-4 px-1">
              <NewMenu variant="sidebar" />
            </div>
            <Nav />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Mobile top bar */}
            <header className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur print:hidden dark:border-slate-700/60 dark:bg-slate-900/95 lg:hidden">
              <BrandMark />
            </header>

            <main id="main-content" className="min-w-0 flex-1 overflow-y-auto" role="main">
              <div className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-6 print:px-0 print:py-0">
                <LayoutShell>{children}</LayoutShell>
              </div>
            </main>
          </div>

          {/* Mobile bottom navigation */}
          <MobileNav />
        </AppProvider>
      </body>
    </html>
  );
}
