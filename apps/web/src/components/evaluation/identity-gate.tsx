'use client';

import { ArrowLeft, CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { Button, Input } from 'antd';
import { useState } from 'react';

import type { EvaluatorIdentity } from '@/lib/evaluation/storage';

interface IdentityGateProps {
  clubName: string;
  meetingLabel: string;
  speakerName: string;
  speechTitle: string;
  /** The evaluator assigned to this speech, if any. When set we ask a Yes/No
   * question up front; when absent we skip straight to the name form. */
  assignedEvaluatorName?: string;
  onConfirmed: (identity: Omit<EvaluatorIdentity, 'confirmedAt'>) => void;
}

type Mode = 'question' | 'name';

export function IdentityGate({
  clubName,
  meetingLabel,
  speakerName,
  speechTitle,
  assignedEvaluatorName,
  onConfirmed,
}: IdentityGateProps) {
  const [mode, setMode] = useState<Mode>(assignedEvaluatorName ? 'question' : 'name');
  const [nameInput, setNameInput] = useState('');
  const trimmed = nameInput.trim();

  function handleYes() {
    if (!assignedEvaluatorName) return;
    onConfirmed({ name: assignedEvaluatorName, isAssignedEvaluator: true });
  }

  function handleNameSubmit() {
    if (!trimmed) return;
    onConfirmed({ name: trimmed, isAssignedEvaluator: false });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center px-4 py-10">
      <section className="w-full overflow-hidden rounded-2xl border border-line bg-sidebar shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <header className="border-b border-line px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Before you begin
          </p>
          <h1 className="mt-1 text-lg font-semibold text-ink">Confirm who you are</h1>
        </header>

        {mode === 'question' && assignedEvaluatorName ? (
          <div className="flex flex-col gap-5 px-6 py-6">
            <p className="text-sm leading-relaxed text-ink">
              Are you <span className="font-semibold text-ink">{assignedEvaluatorName}</span>,
              evaluating{' '}
              <span className="italic">{speechTitle ? `“${speechTitle}”` : 'this speech'}</span> by{' '}
              <span className="font-semibold text-ink">{speakerName || 'this speaker'}</span> at{' '}
              <span className="font-semibold text-ink">{clubName}</span>
              {meetingLabel ? (
                <>
                  {' '}
                  · <span className="text-ink-soft">{meetingLabel}</span>
                </>
              ) : null}
              ?
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
                Yes, that&apos;s me
              </Button>
              <Button size="large" onClick={() => setMode('name')} className="sm:min-w-40" block>
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
              <label htmlFor="evaluator-name" className="mb-1.5 block text-xs font-medium text-ink">
                What&apos;s your name?
              </label>
              <Input
                id="evaluator-name"
                size="large"
                autoFocus
                placeholder="e.g. Priya Sharma"
                value={nameInput}
                maxLength={80}
                onChange={(event) => setNameInput(event.target.value)}
              />
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Your name is shared with the evaluator only — it isn&apos;t published anywhere.
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
              {assignedEvaluatorName ? (
                <Button
                  size="large"
                  icon={<ArrowLeft size={14} weight="bold" />}
                  onClick={() => setMode('question')}
                  className="sm:min-w-40"
                  block
                >
                  Back
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
