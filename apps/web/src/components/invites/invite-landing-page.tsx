'use client';

import { CheckCircle, Warning } from '@phosphor-icons/react/dist/ssr';
import { Button, Spin, Tag } from 'antd';
import Image from 'next/image';
import Link from 'next/link';

import { useLightSession } from '@/lib/auth/use-light-session';
import { useGetPublicInvitePreviewQuery } from '@/store/api';

import toastieLogo from '../../../assets/toastie.svg';

interface InviteLandingPageProps {
  token: string;
}

const STATE_COPY: Record<'expired' | 'accepted' | 'revoked', { title: string; body: string }> = {
  expired: {
    title: 'This invite has expired',
    body: 'Ask whoever sent it to generate a fresh link.',
  },
  accepted: {
    title: 'This invite has already been used',
    body: 'If that was you, sign in and you should already have access.',
  },
  revoked: {
    title: 'This invite is no longer valid',
    body: 'It was revoked. Ask whoever sent it to generate a fresh link.',
  },
};

/** Public landing page for a `/invite/:token` join link — the first stop
 * for whoever opens it, signed in or not. A visitor who's already signed in
 * (e.g. a member of one club opening an invite to a second) skips straight
 * past the "do you have an account?" choice, since asking is pointless. */
export function InviteLandingPage({ token }: InviteLandingPageProps) {
  const {
    data: preview,
    isLoading,
    isError,
  } = useGetPublicInvitePreviewQuery(token, {
    skip: !token,
  });
  const { status: sessionStatus, session } = useLightSession();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !preview) {
    return (
      <InviteEmptyState
        title="This link isn't valid"
        body="Double-check the link, or ask whoever sent it for a fresh one."
      />
    );
  }

  if (preview.state !== 'valid') {
    const copy = STATE_COPY[preview.state];
    return <InviteEmptyState title={copy.title} body={copy.body} />;
  }

  const acceptHref = `/invite/${token}/accept`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <Image src={toastieLogo} alt="" aria-hidden className="h-8 w-auto" priority />

      <section className="w-full rounded-2xl border border-line bg-sidebar p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h1 className="text-lg font-semibold text-ink">
          You&rsquo;re invited to {preview.clubName}
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
          Joining as{' '}
          {preview.roles.length > 0 ? (
            preview.roles.map((role) => (
              <Tag key={role} className="m-0">
                {role}
              </Tag>
            ))
          ) : (
            <Tag className="m-0">Member</Tag>
          )}
        </p>

        <div className="mt-5">
          {sessionStatus === 'checking' ? (
            <div className="flex items-center justify-center py-2">
              <Spin />
            </div>
          ) : sessionStatus === 'authenticated' ? (
            <Link href={acceptHref}>
              <Button type="primary" block size="large">
                Continue as {session?.user.firstName}
              </Button>
            </Link>
          ) : (
            <>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
                Do you have an account?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={`/login?next=${encodeURIComponent(acceptHref)}`} className="w-full">
                  <Button block size="large">
                    Yes, log in
                  </Button>
                </Link>
                <Link href={`/register?next=${encodeURIComponent(acceptHref)}`} className="w-full">
                  <Button type="primary" block size="large">
                    No, sign up
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <p className="flex items-center gap-1.5 text-center text-xs text-ink-muted">
        <CheckCircle size={14} />
        This link works once and can be revoked at any time by the club.
      </p>
    </div>
  );
}

function InviteEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <section className="w-full rounded-2xl border border-line bg-sidebar p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill text-ink-soft">
          <Warning size={22} />
        </div>
        <h1 className="mt-3 text-lg font-semibold text-ink">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
        <Link href="/login" className="mt-4 inline-block">
          <Button>Go to login</Button>
        </Link>
      </section>
    </div>
  );
}
