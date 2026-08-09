'use client';

import { Warning } from '@phosphor-icons/react/dist/ssr';
import { Button, Spin, Tag } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { writeStoredContext } from '@/lib/auth/token-storage';
import { useLightSession } from '@/lib/auth/use-light-session';
import { useAcceptInviteMutation, useGetPublicInvitePreviewQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

import toastieLogo from '../../../assets/toastie.svg';

interface InviteAcceptPageProps {
  token: string;
}

type Phase = 'ready' | 'accepting' | 'redirecting';

/** Where a signed-in visitor lands after choosing "log in" or "sign up" on
 * `/invite/:token`. Deliberately in the `(public)` route group rather than
 * under `(app)` — `AppFrame` shows the onboarding screen for any signed-in
 * user with zero memberships regardless of path, which would swallow this
 * page for exactly the person who needs it (a brand-new account accepting
 * their first invite). */
export function InviteAcceptPage({ token }: InviteAcceptPageProps) {
  const router = useRouter();
  const { status: sessionStatus, session } = useLightSession();
  const { data: preview, isLoading: previewLoading } = useGetPublicInvitePreviewQuery(token, {
    skip: !token,
  });
  const [acceptInvite, { isLoading: isAccepting }] = useAcceptInviteMutation();

  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState<string | null>(null);
  const [redirectClubName, setRedirectClubName] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace(`/invite/${token}`);
    }
  }, [sessionStatus, router, token]);

  async function handleAccept() {
    setError(null);
    setPhase('accepting');
    try {
      const result = await acceptInvite(token).unwrap();
      // The freshly-created Membership makes this the club we want to land
      // in, which may not match whatever `defaultContextKey` a returning
      // user's session would otherwise resolve to — `SessionProvider`
      // (mounted by `(app)/layout.tsx` on the next navigation) prefers a
      // stored context over its own default when the stored one still
      // validates against the fetched session.
      writeStoredContext(`club:${result.clubId}`);
      setRedirectClubName(result.clubName);
      setPhase('redirecting');
      router.replace('/');
    } catch (err) {
      setPhase('ready');
      setError(getApiErrorMessage(err, 'Could not accept this invite'));
    }
  }

  if (sessionStatus === 'checking' || previewLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    // Redirect effect above is already in flight — render nothing rather
    // than flash the accept card for a visitor about to bounce.
    return null;
  }

  if (preview?.state !== 'valid') {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <section className="w-full rounded-2xl border border-line bg-sidebar p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill text-ink-soft">
            <Warning size={22} />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-ink">This invite is no longer valid</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            It may have expired, been used already, or been revoked.
          </p>
          <Link href="/" className="mt-4 inline-block">
            <Button>Go to your dashboard</Button>
          </Link>
        </section>
      </div>
    );
  }

  if (phase === 'redirecting') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Spin size="large" />
        <p className="text-sm text-ink-soft">Redirecting you to {redirectClubName}&hellip;</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <Image src={toastieLogo} alt="" aria-hidden className="h-8 w-auto" priority />

      <section className="w-full rounded-2xl border border-line bg-sidebar p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h1 className="text-lg font-semibold text-ink">Join {preview.clubName}?</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Signed in as {session?.user.firstName} {session?.user.lastName}.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
          You&rsquo;ll join as{' '}
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

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <Button
          type="primary"
          block
          size="large"
          className="mt-5"
          loading={isAccepting || phase === 'accepting'}
          onClick={() => void handleAccept()}
        >
          Accept & join
        </Button>
      </section>
    </div>
  );
}
