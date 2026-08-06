import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meeting role · Toastly',
  robots: { index: false, follow: false },
};

export default function RolePublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
