import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meeting vote · Toastly',
  robots: { index: false, follow: false },
};

export default function VoteLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
