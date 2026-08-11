'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import toastieLogo from '../../../assets/toastie.svg';

/** Full-bleed backdrop shared by every unauthenticated, credential-adjacent
 * screen (sign in, sign up, invite landing/accept) — a dawn-sky gradient
 * built from the wordmark's own navy/amber/teal rather than the app shell's
 * near-monochrome tokens, since these pages are the one place a first-time
 * visitor meets the brand before the product's working chrome takes over. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b2a4c] p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(248,153,12,0.32), transparent 70%),' +
            'linear-gradient(180deg, #0b2a4c 0%, #123a63 26%, #5f89ac 56%, #d3e3ee 82%, #f6f9fb 100%)',
        }}
      />

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5">
        <div className="absolute -bottom-12 left-[6%] h-40 w-72 rounded-full bg-white/70 blur-3xl" />
        <div className="absolute -bottom-16 right-[8%] h-48 w-96 rounded-full bg-white/60 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-72 rounded-full bg-white/55 blur-3xl" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2"
      >
        <div className="size-[560px] rounded-full border border-white/25" />
        <div className="absolute inset-0 m-auto size-[420px] rounded-full border border-white/20" />
        <div className="absolute inset-0 m-auto size-[280px] rounded-full border border-white/15" />
      </div>

      <Link
        href="/"
        className="absolute left-6 top-6 z-10 flex items-center gap-2 text-white sm:left-8 sm:top-8"
      >
        <Image
          src={toastieLogo}
          alt=""
          aria-hidden
          className="h-7 w-auto drop-shadow-sm"
          priority
        />
        <span className="text-sm font-semibold tracking-wide">Toastie</span>
      </Link>

      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
