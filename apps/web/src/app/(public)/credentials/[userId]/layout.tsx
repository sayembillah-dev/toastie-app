import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your login details · Toastie',
  robots: { index: false, follow: false },
};

export default function CredentialsPublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
