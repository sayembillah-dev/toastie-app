import type { Metadata } from 'next';

import { AntdProvider } from '@/components/antd-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'Toastly',
  description: 'Next.js + NestJS monorepo with Tailwind CSS and Ant Design',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
