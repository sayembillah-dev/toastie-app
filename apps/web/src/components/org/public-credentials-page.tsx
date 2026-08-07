'use client';

import { Copy, Warning } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Spin } from 'antd';
import Image from 'next/image';
import Link from 'next/link';

import { useGetCredentialShareQuery } from '@/store/api';

import toastieLogo from '../../../assets/toastie.svg';

interface PublicCredentialsPageProps {
  userId: string;
  token: string;
}

/** Public "here are your login details" page — what the Super Admin's
 * direct link / QR code point at. Mirrors `PublicRolePage`'s shape: an
 * anonymous, token-gated fetch against `/public/users/:userId/credentials`,
 * a centered card, a not-found state for a used/invalid link. Unlike the
 * meeting share pages this one shows a secret once, so there's no
 * interactive view underneath it — just the credentials and a way to log in. */
export function PublicCredentialsPage({ userId, token }: PublicCredentialsPageProps) {
  const { message } = App.useApp();
  const { data, isLoading } = useGetCredentialShareQuery(
    { userId, token },
    { skip: !userId || !token },
  );

  async function handleCopy() {
    if (!data) return;
    const summary = [
      `${data.firstName} ${data.lastName}`,
      `Mobile: ${data.phone}`,
      `Password: ${data.password}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      message.success('Copied');
    } catch {
      message.error('Could not copy — select the text manually');
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <section className="w-full rounded-2xl border border-line bg-sidebar p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill text-ink-soft">
            <Warning size={22} />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-ink">This link has been used</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            It stops working the moment its account signs in for the first time — or the link may
            just be out of date. Ask your Club Admin or Super Admin for a fresh one.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <Image src={toastieLogo} alt="" aria-hidden className="h-8 w-auto" priority />

      <section className="w-full rounded-2xl border border-line bg-sidebar p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h1 className="text-lg font-semibold text-ink">Welcome, {data.firstName}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          A Toastie account was created for you. Here are your login details — you&rsquo;ll be asked
          to set your own password the first time you sign in.
        </p>

        <dl className="mt-4 flex flex-col gap-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Mobile number
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">{data.phone}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Password</dt>
            <dd className="mt-0.5 font-mono text-sm font-medium text-ink">{data.password}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center gap-2">
          <Button icon={<Copy size={14} />} onClick={handleCopy} block>
            Copy details
          </Button>
          <Link href="/login" className="w-full">
            <Button type="primary" block>
              Go to login
            </Button>
          </Link>
        </div>
      </section>

      <p className="text-center text-xs text-ink-muted">
        This page only works once — it stops showing your password after you log in.
      </p>
    </div>
  );
}
