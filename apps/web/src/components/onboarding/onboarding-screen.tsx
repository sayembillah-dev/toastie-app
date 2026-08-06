'use client';

import { EnvelopeSimple, MagnifyingGlass, PaperPlaneTilt } from '@phosphor-icons/react/dist/ssr';
import { Button } from 'antd';
import Image from 'next/image';

import toastieLogo from '../../../assets/toastie.svg';

/** Landing screen for a signed-in user with no memberships and no org
 * assignments — the state a freshly-registered account is in before their
 * first invite is accepted or join request approved.
 *
 * Deliberately not a dashboard: three concrete paths forward, each pointing
 * at a surface built out in later slices. The endpoints those buttons will
 * call land in S10; today the buttons are cosmetic. */
export function OnboardingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-muted p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-canvas p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Image src={toastieLogo} alt="" aria-hidden className="h-8 w-auto" priority />
          <span className="text-base font-semibold text-ink">Toastie</span>
        </div>

        <h1 className="text-xl font-semibold text-ink">Welcome to Toastie.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          You&rsquo;re signed in but not yet part of a club. Choose how you&rsquo;d like to get
          started.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <OnboardingAction
            Icon={MagnifyingGlass}
            title="Browse clubs"
            description="Find a Toastmasters club near you and request to join."
          />
          <OnboardingAction
            Icon={EnvelopeSimple}
            title="Paste an invite code"
            description="A Club Admin already added you? Enter the code from your email."
          />
          <OnboardingAction
            Icon={PaperPlaneTilt}
            title="Start a new club"
            description="Charter a new club and become its first admin."
          />
        </div>

        <p className="mt-6 text-xs text-ink-muted">
          Once you&rsquo;re a member of a club, this screen goes away and the dashboard becomes your
          home.
        </p>
      </div>
    </div>
  );
}

interface OnboardingActionProps {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}

function OnboardingAction({ Icon, title, description }: OnboardingActionProps) {
  return (
    <Button
      block
      size="large"
      className="h-auto items-start justify-start whitespace-normal py-3 text-left"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill text-ink-soft">
          <Icon size={18} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-ink">{title}</span>
          <span className="text-xs text-ink-muted">{description}</span>
        </span>
      </div>
    </Button>
  );
}
