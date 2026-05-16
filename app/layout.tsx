import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import OnboardingGate from '@/components/OnboardingGate';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import { AppProvider } from '@/lib/context';

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
          <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-slate-200 bg-white px-2 py-4 print:hidden dark:border-slate-700/60 dark:bg-slate-900 lg:w-56 lg:px-3" aria-label="Main navigation">
            <div className="mb-6 flex items-center gap-2 px-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <span className="hidden text-lg font-bold tracking-tight text-slate-900 dark:text-white lg:block">
                Accounts
              </span>
            </div>
            <Nav />
          </aside>
          <main id="main-content" className="min-w-0 flex-1 overflow-y-auto" role="main">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 print:px-0 print:py-0">
              {children}
            </div>
          </main>
        </AppProvider>
      </body>
    </html>
  );
}
