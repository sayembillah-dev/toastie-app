import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Speaker evaluation · Toastly',
  robots: { index: false, follow: false },
};

export default function EvaluateLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
