import type { Metadata, Viewport } from 'next';

import { AntdProvider } from '@/components/antd-provider';
import { OfflineScreen } from '@/components/offline-screen';
import { StoreProvider } from '@/components/store-provider';

import './globals.css';
import './print.css';

export const metadata: Metadata = {
  title: 'Toastie',
  description: 'Next.js + NestJS monorepo with Tailwind CSS and Ant Design',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Toastie',
  },
};

export const viewport: Viewport = {
  // Matches `manifest.ts`'s `theme_color` / antd's `colorPrimary`.
  themeColor: '#1c1c1c',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <StoreProvider>
          <AntdProvider>{children}</AntdProvider>
        </StoreProvider>
        <OfflineScreen />
      </body>
    </html>
  );
}
