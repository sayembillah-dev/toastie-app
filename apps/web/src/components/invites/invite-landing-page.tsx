'use client';

import { CheckCircle, EnvelopeSimpleOpen, Warning } from '@phosphor-icons/react/dist/ssr';
import { Button, Spin, Tag } from 'antd';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { useLightSession } from '@/lib/auth/use-light-session';
import { useGetPublicInvitePreviewQuery } from '@/store/api';

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
      <AuthShell>
        <div className="flex justify-center">
          <Spin size="large" />
        </div>
      </AuthShell>
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
    <AuthShell>
      <AuthCard
        icon={EnvelopeSimpleOpen}
        title={`You’re invited to ${preview.clubName}`}
        subtitle={
          <span className="flex flex-wrap items-center justify-center gap-1.5">
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
          </span>
        }
        footer={
          <span className="flex items-center justify-center gap-1.5">
            <CheckCircle size={14} />
            This link works once and can be revoked at any time by the club.
          </span>
        }
      >
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
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-ink-muted">
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
      </AuthCard>
    </AuthShell>
  );
}

function InviteEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <AuthShell>
      <AuthCard icon={Warning} title={title} subtitle={body}>
        <Link href="/login" className="block">
          <Button block size="large">
            Go to login
          </Button>
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
