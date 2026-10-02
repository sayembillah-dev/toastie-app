import type { Metadata, Viewport } from 'next';

import { AntdProvider } from '@/components/antd-provider';
import { OfflineScreen } from '@/components/offline-screen';
import { PwaServiceWorker } from '@/components/pwa-service-worker';
import { StoreProvider } from '@/components/store-provider';
import { INSTALL_CAPTURE_SCRIPT } from '@/lib/pwa/install';

import './globals.css';
import './print.css';

// Falls back to prod so a build without `SITE_URL` set still produces
// absolute og:image/canonical URLs instead of broken relative ones.
const SITE_URL = process.env.SITE_URL ?? 'https://toastie.niftyitsolution.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Toastie',
  description: 'Club management for Toastmasters clubs — meetings, education, and members.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Toastie',
  },
  openGraph: {
    title: 'Toastie',
    description: 'Club management for Toastmasters clubs — meetings, education, and members.',
    siteName: 'Toastie',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Toastie',
    description: 'Club management for Toastmasters clubs — meetings, education, and members.',
  },
};

export const viewport: Viewport = {
  // Matches `manifest.ts`'s `theme_color` / antd's `colorPrimary`.
  themeColor: '#1c1c1c',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* A plain inline script, not `next/script`: App Router queues inline
         * `beforeInteractive` code until Next's runtime boots, which can be
         * after Chrome has already fired `beforeinstallprompt`. This runs
         * during HTML parse. The content is a static constant — no input. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party constant */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
       * cz-shortcut-listen) mutate <body> before hydration; the mismatch is
       * attribute-only and one level deep, which is exactly what this
       * silences — real tree mismatches still warn. */}
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <StoreProvider>
          <AntdProvider>{children}</AntdProvider>
        </StoreProvider>
        <OfflineScreen />
        <PwaServiceWorker />
      </body>
    </html>
  );
}
