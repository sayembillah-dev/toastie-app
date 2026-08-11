'use client';

import { UsersThree, Warning } from '@phosphor-icons/react/dist/ssr';
import { Button, Spin, Tag } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { writeStoredContext } from '@/lib/auth/token-storage';
import { useLightSession } from '@/lib/auth/use-light-session';
import { useAcceptInviteMutation, useGetPublicInvitePreviewQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

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
      <AuthShell>
        <div className="flex justify-center">
          <Spin size="large" />
        </div>
      </AuthShell>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    // Redirect effect above is already in flight — render nothing rather
    // than flash the accept card for a visitor about to bounce.
    return null;
  }

  if (preview?.state !== 'valid') {
    return (
      <AuthShell>
        <AuthCard
          icon={Warning}
          title="This invite is no longer valid"
          subtitle="It may have expired, been used already, or been revoked."
        >
          <Link href="/" className="block">
            <Button block size="large">
              Go to your dashboard
            </Button>
          </Link>
        </AuthCard>
      </AuthShell>
    );
  }

  if (phase === 'redirecting') {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-3">
          <Spin size="large" />
          <p className="text-sm text-ink-soft">Redirecting you to {redirectClubName}&hellip;</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        icon={UsersThree}
        title={`Join ${preview.clubName}?`}
        subtitle={
          <>
            Signed in as {session?.user.firstName} {session?.user.lastName}.
            <span className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
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
            </span>
          </>
        }
      >
        {error ? <p className="mb-3 text-center text-sm text-red-600">{error}</p> : null}

        <Button
          type="primary"
          block
          size="large"
          loading={isAccepting || phase === 'accepting'}
          onClick={() => void handleAccept()}
        >
          Accept & join
        </Button>
      </AuthCard>
    </AuthShell>
  );
}
