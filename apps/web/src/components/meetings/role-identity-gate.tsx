'use client';

import { ArrowLeft, CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { Button, Input } from 'antd';
import { useState } from 'react';

import type { RoleHolderIdentity } from '@/lib/meetings/role-identity';

interface RoleIdentityGateProps {
  clubName: string;
  meetingLabel: string;
  roleLabel: string;
  /** The member assigned to this role in the meeting draft, if any. When set,
   * the Yes/No question names them directly ("Are you Priya, the Timer …?");
   * when absent (e.g. a guest on a phone opening the QR link without redux
   * state), the question falls back to a generic phrasing. */
  assignedHolderName?: string;
  onConfirmed: (identity: Omit<RoleHolderIdentity, 'confirmedAt'>) => void;
}

type Mode = 'question' | 'name-assigned' | 'name-guest';

/** Identity gate for the public role pages. First page is always a Yes/No —
 * "are you the assigned role holder?" — regardless of whether the draft knows
 * the name. From there:
 *   - Yes with known name → confirmed immediately as the assigned holder.
 *   - Yes without a known name → collect the name, mark as assigned.
 *   - No → collect the name, mark as a stand-in. */
export function RoleIdentityGate({
  clubName,
  meetingLabel,
  roleLabel,
  assignedHolderName,
  onConfirmed,
}: RoleIdentityGateProps) {
  const [mode, setMode] = useState<Mode>('question');
  const [nameInput, setNameInput] = useState('');
  const trimmed = nameInput.trim();

  function handleYes() {
    if (assignedHolderName) {
      /* Draft already knows the assigned member — no need to ask again. */
      onConfirmed({ name: assignedHolderName, isAssignedHolder: true });
      return;
    }
    /* The public link doesn't carry the assignment (e.g. opened on a phone),
     * so we still need to collect the name — but mark them as the assigned
     * holder for the badge on the header. */
    setMode('name-assigned');
  }

  function handleNo() {
    setMode('name-guest');
  }

  function handleNameSubmit() {
    if (!trimmed) return;
    onConfirmed({ name: trimmed, isAssignedHolder: mode === 'name-assigned' });
  }

  const contextSuffix = (
    <>
      <span className="font-semibold text-ink">{clubName}</span>
      {meetingLabel ? (
        <>
          {' '}
          · <span className="text-ink-soft">{meetingLabel}</span>
        </>
      ) : null}
    </>
  );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center px-4 py-10">
      <section className="w-full overflow-hidden rounded-2xl border border-line bg-sidebar shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <header className="border-b border-line px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Before you begin
          </p>
          <h1 className="mt-1 text-lg font-semibold text-ink">Confirm who you are</h1>
        </header>

        {mode === 'question' ? (
          <div className="flex flex-col gap-5 px-6 py-6">
            <p className="text-sm leading-relaxed text-ink">
              {assignedHolderName ? (
                <>
                  Are you <span className="font-semibold text-ink">{assignedHolderName}</span>, the{' '}
                  <span className="font-semibold text-ink">{roleLabel}</span> at {contextSuffix}?
                </>
              ) : (
                <>
                  Are you the assigned <span className="font-semibold text-ink">{roleLabel}</span>{' '}
                  for {contextSuffix}?
                </>
              )}
            </p>

            <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
              <Button
                type="primary"
                size="large"
                icon={<CheckCircle size={16} weight="fill" />}
                onClick={handleYes}
                className="sm:min-w-40"
                block
              >
                {assignedHolderName ? "Yes, that's me" : 'Yes, that is me'}
              </Button>
              <Button size="large" onClick={handleNo} className="sm:min-w-40" block>
                No, I&apos;m someone else
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-5 px-6 py-6"
            onSubmit={(event) => {
              event.preventDefault();
              handleNameSubmit();
            }}
          >
            <div>
              <p className="mb-2 text-sm leading-relaxed text-ink">
                {mode === 'name-assigned' ? (
                  <>
                    You&apos;re the assigned{' '}
                    <span className="font-semibold text-ink">{roleLabel}</span> for {contextSuffix}.
                  </>
                ) : (
                  <>
                    You&apos;re standing in as{' '}
                    <span className="font-semibold text-ink">{roleLabel}</span> at {contextSuffix}.
                  </>
                )}
              </p>
              <label
                htmlFor="role-holder-name"
                className="mb-1.5 block text-xs font-medium text-ink"
              >
                What&apos;s your name?
              </label>
              <Input
                id="role-holder-name"
                size="large"
                autoFocus
                placeholder="e.g. Priya Sharma"
                value={nameInput}
                maxLength={80}
                onChange={(event) => setNameInput(event.target.value)}
              />
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Shown to the meeting host so they know who is on the {roleLabel.toLowerCase()}{' '}
                console.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                disabled={!trimmed}
                className="sm:min-w-40"
                block
              >
                Continue
              </Button>
              <Button
                size="large"
                icon={<ArrowLeft size={14} weight="bold" />}
                onClick={() => {
                  setMode('question');
                  setNameInput('');
                }}
                className="sm:min-w-40"
                block
              >
                Back
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
