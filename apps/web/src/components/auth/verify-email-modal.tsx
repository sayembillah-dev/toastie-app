'use client';

import {
  ArrowLeft,
  CheckCircle,
  EnvelopeSimple,
  EnvelopeSimpleOpen,
  LockKey,
  PencilSimple,
  SealCheck,
  SignOut,
} from '@phosphor-icons/react/dist/ssr';
import { Alert, App, Button, Form, Input, Modal } from 'antd';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState } from 'react';

import { CodeField, ResendCode, useResendCooldown } from '@/components/auth/resend-code';
import { applySessionPayload, useSessionRefresh } from '@/components/session-provider';
import { useSignOut } from '@/lib/auth/use-sign-out';
import { emailRules } from '@/lib/validation/rules';
import { toastlyApi, useAuthEmailSendCodeMutation, useAuthEmailVerifyMutation } from '@/store/api';
import { getErrorCode, getFieldErrors, isRateLimited } from '@/store/api-error';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectSessionUser } from '@/store/session-slice';

/** How long the "Email verified" state stays up before the modal closes. */
const SUCCESS_HOLD_MS = 1600;

interface VerifyEmailModalProps {
  /** The account still needs a verified email — `emailVerified === false`
   * or `mustVerifyEmail`. `AppFrame` decides; this component only adds the
   * short success hold on top. */
  required: boolean;
}

/** The email prompt that sits over the dashboard while the account has no
 * verified email. It cannot be dismissed — no close button, no mask click,
 * no Escape — the only way out besides finishing is signing out. The page
 * behind stays visible (blurred) and keeps loading its reads; the modal's
 * focus trap keeps every write out of reach.
 *
 * Mounted for every signed-in user so the success state can outlive the
 * fresh session that clears `required`. */
export function VerifyEmailModal({ required }: VerifyEmailModalProps) {
  const [celebrating, setCelebrating] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!celebrating) return;
    const id = window.setTimeout(() => setCelebrating(false), SUCCESS_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [celebrating]);

  return (
    <Modal
      open={required || celebrating}
      closable={false}
      keyboard={false}
      mask={{ closable: false, blur: true }}
      focusable={{ trap: true }}
      footer={null}
      centered
      destroyOnHidden
      width={440}
      wrapProps={{ 'aria-labelledby': titleId }}
      styles={{
        container: { padding: 0, overflow: 'hidden', borderRadius: 20 },
        mask: { backgroundColor: 'rgba(17, 17, 17, 0.38)' },
      }}
    >
      <VerifyEmailBody titleId={titleId} onVerified={() => setCelebrating(true)} />
    </Modal>
  );
}

type Step = 'email' | 'code' | 'done';

interface SendValues {
  email?: string;
  currentPassword: string;
}

interface CodeValues {
  code: string;
}

function VerifyEmailBody({ titleId, onVerified }: { titleId: string; onVerified: () => void }) {
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const user = useAppSelector(selectSessionUser);
  const signOut = useSignOut();
  const refreshSession = useSessionRefresh();
  const reduceMotion = useReducedMotion();

  // Captured once: after success the fresh session carries the new address,
  // and the copy shouldn't flip from "Add" to "Verify" mid-celebration.
  const [savedEmail] = useState<string | null>(() => user?.email ?? null);
  const isAdding = savedEmail === null;

  const [step, setStep] = useState<Step>('email');
  /** Editing a typed address rather than confirming the one on file. */
  const [editing, setEditing] = useState(isAdding);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sendForm] = Form.useForm<SendValues>();
  const [codeForm] = Form.useForm<CodeValues>();
  const [sendCode, { isLoading: isSending }] = useAuthEmailSendCodeMutation();
  const [verify, { isLoading: isVerifying }] = useAuthEmailVerifyMutation();
  const cooldown = useResendCooldown(60);

  function switchToNewEmail() {
    setError(null);
    setEditing(true);
    setStep('email');
    sendForm.setFieldValue('email', '');
  }

  /** Returns true when a code went out. Errors land on the send form's
   * fields when they're showing, otherwise in the alert. */
  async function requestCode(address: string, currentPassword: string): Promise<boolean> {
    setError(null);
    try {
      await sendCode({ email: address, currentPassword }).unwrap();
      cooldown.start();
      return true;
    } catch (err) {
      const code = getErrorCode(err);
      const onForm = step === 'email';
      if (code === 'INVALID_CREDENTIALS') {
        if (onForm) {
          sendForm.setFields([{ name: 'currentPassword', errors: ['Password is incorrect'] }]);
        } else {
          setStep('email');
          setError('Your password has changed. Enter it again to get a new code.');
        }
        return false;
      }
      if (code === 'EMAIL_TAKEN') {
        if (onForm && editing) {
          sendForm.setFields([
            { name: 'email', errors: ['That email is linked to another account'] },
          ]);
        } else {
          setEditing(true);
          setStep('email');
          setError('That email is linked to another account. Use a different one.');
        }
        return false;
      }
      if (code === 'EMAIL_ALREADY_VERIFIED') {
        // The session is stale — this account is already verified.
        await refreshSession();
        return false;
      }
      if (code === 'OTP_COOLDOWN') {
        setError('Wait a minute, then ask for a new code.');
        return false;
      }
      if (code === 'OTP_LIMIT') {
        setError('Too many codes. Try again later.');
        return false;
      }
      if (code === 'MAIL_SEND_FAILED') {
        setError('We could not send the email. Check the address and try again.');
        return false;
      }
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors && onForm) {
        const shown = Object.entries(fieldErrors).filter(
          ([name]) => name === 'currentPassword' || (name === 'email' && editing),
        );
        if (shown.length > 0) {
          sendForm.setFields(
            shown.map(([name, errors]) => ({ name: name as keyof SendValues, errors })),
          );
        } else {
          setError(Object.values(fieldErrors).flat()[0] ?? 'Check the details and try again.');
        }
        return false;
      }
      setError(
        isRateLimited(err)
          ? 'Too many requests. Wait a minute and try again.'
          : 'Could not send the code. Please try again.',
      );
      return false;
    }
  }

  async function onSend(values: SendValues) {
    const address = (editing ? (values.email ?? '') : (savedEmail ?? '')).trim().toLowerCase();
    if (await requestCode(address, values.currentPassword)) {
      setEmail(address);
      setPassword(values.currentPassword);
      codeForm.resetFields();
      setStep('code');
    }
  }

  async function onResend() {
    if (await requestCode(email, password)) message.success('Code sent');
  }

  async function onVerify(values: CodeValues) {
    setError(null);
    try {
      const session = await verify({ email, code: values.code }).unwrap();
      setPassword('');
      setStep('done');
      onVerified();
      // Anything that 403'd while gated is cached as an error — start clean.
      dispatch(toastlyApi.util.resetApiState());
      applySessionPayload(dispatch, session);
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'OTP_INVALID') {
        codeForm.setFields([
          { name: 'code', errors: ['That code is wrong or has expired. Try again or resend.'] },
        ]);
        return;
      }
      if (code === 'EMAIL_TAKEN') {
        setEditing(true);
        setStep('email');
        setError('That email was just linked to another account. Use a different one.');
        return;
      }
      setError(
        isRateLimited(err)
          ? 'Too many attempts. Wait a minute and try again.'
          : 'Could not verify the code. Please try again.',
      );
    }
  }

  const header = headerFor(step, isAdding);
  const slide = reduceMotion ? 0 : 16;

  return (
    <div className="relative">
      {/* Soft wash behind the badge — gives the top of the card some depth
          without leaving the app's neutral palette. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-fill to-transparent"
      />

      <div className="relative px-6 pt-8 pb-6 sm:px-8">
        <div className="mb-5 flex justify-center">
          <div
            className={`flex size-14 items-center justify-center rounded-2xl shadow-[0_10px_30px_-12px_rgba(17,17,17,0.55)] transition-colors duration-300 ${
              step === 'done' ? 'bg-emerald-600 text-white' : 'bg-ink text-white'
            }`}
          >
            <header.icon size={26} weight="bold" />
          </div>
        </div>

        {step === 'done' ? null : <StepIndicator step={step} />}

        <h2 id={titleId} className="text-center text-xl font-semibold tracking-tight text-ink">
          {header.title}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-center text-sm leading-relaxed text-ink-soft">
          {step === 'code' ? (
            <>
              Enter the 6-digit code we sent to{' '}
              <span className="font-medium break-all text-ink">{email}</span>.
            </>
          ) : step === 'done' ? (
            <>
              <span className="font-medium break-all text-ink">{email}</span> is now your sign-in
              email.
            </>
          ) : (
            header.subtitle
          )}
        </p>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: slide }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -slide }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6"
          >
            {error && step !== 'done' ? (
              <Alert type="error" showIcon className="!mb-4" message={error} />
            ) : null}

            {step === 'email' ? (
              <Form<SendValues>
                form={sendForm}
                layout="vertical"
                onFinish={onSend}
                disabled={isSending}
                requiredMark={false}
              >
                {editing ? (
                  <Form.Item
                    label={isAdding ? 'Email' : 'New email'}
                    name="email"
                    rules={emailRules({ required: true })}
                  >
                    <Input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      size="large"
                      placeholder="name@example.com"
                      autoFocus
                      prefix={<EnvelopeSimple size={16} className="text-ink-muted" />}
                    />
                  </Form.Item>
                ) : (
                  <AddressOnFile
                    address={savedEmail ?? ''}
                    onChange={switchToNewEmail}
                    disabled={isSending}
                  />
                )}

                <Form.Item
                  label="Current password"
                  name="currentPassword"
                  rules={[{ required: true, message: 'Enter your password' }]}
                  extra="We ask for it because this email will sign you in."
                >
                  <Input.Password
                    autoComplete="current-password"
                    size="large"
                    autoFocus={!editing}
                    prefix={<LockKey size={16} className="text-ink-muted" />}
                  />
                </Form.Item>

                <Form.Item className="!mb-0">
                  <Button type="primary" htmlType="submit" block size="large" loading={isSending}>
                    Send code
                  </Button>
                </Form.Item>

                {editing && !isAdding ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditing(false);
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    <ArrowLeft size={12} weight="bold" />
                    Keep {savedEmail}
                  </button>
                ) : null}
              </Form>
            ) : null}

            {step === 'code' ? (
              <div>
                <Form<CodeValues>
                  form={codeForm}
                  layout="vertical"
                  onFinish={onVerify}
                  disabled={isVerifying}
                  requiredMark={false}
                >
                  <div className="flex justify-center">
                    <CodeField label="" />
                  </div>
                  <Form.Item className="!mb-3">
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      size="large"
                      loading={isVerifying}
                    >
                      Verify email
                    </Button>
                  </Form.Item>
                </Form>
                <ResendCode
                  remaining={cooldown.remaining}
                  loading={isSending}
                  onResend={onResend}
                />
                <button
                  type="button"
                  onClick={switchToNewEmail}
                  className="mt-2 w-full text-center text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  Use a different email
                </button>
              </div>
            ) : null}

            {step === 'done' ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                <CheckCircle size={18} weight="fill" />
                Email verified — taking you in
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {step === 'done' ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-sidebar px-6 py-3.5 text-xs text-ink-muted sm:px-8">
          <span className="min-w-0 truncate">
            Signed in as{' '}
            <span className="font-medium text-ink-soft">
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.phone}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex shrink-0 items-center gap-1.5 font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <SignOut size={14} weight="bold" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function headerFor(
  step: Step,
  isAdding: boolean,
): { icon: typeof EnvelopeSimple; title: string; subtitle: string } {
  if (step === 'done') return { icon: SealCheck, title: 'Email verified', subtitle: '' };
  if (step === 'code') return { icon: EnvelopeSimpleOpen, title: 'Check your inbox', subtitle: '' };
  return isAdding
    ? {
        icon: EnvelopeSimple,
        title: 'Add your email',
        subtitle: 'Add an email to sign in and recover your account.',
      }
    : {
        icon: SealCheck,
        title: 'Verify your email',
        subtitle: "You'll sign in with this email. Confirm it's yours to keep using Openfloor.",
      };
}

/** Two-step progress: email → code. */
function StepIndicator({ step }: { step: 'email' | 'code' }) {
  const current = step === 'email' ? 1 : 2;
  return (
    <div className="mb-3 flex items-center justify-center gap-2" aria-hidden>
      {[1, 2].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            n === current ? 'w-6 bg-ink' : n < current ? 'w-1.5 bg-ink' : 'w-1.5 bg-line-strong'
          }`}
        />
      ))}
      <span className="sr-only">Step {current} of 2</span>
    </div>
  );
}

/** The address already on the account, shown as a read-only card with a
 * way to swap it for another. */
function AddressOnFile({
  address,
  onChange,
  disabled,
}: {
  address: string;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-sm text-ink">Email</div>
      <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-sidebar px-3.5 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <EnvelopeSimple size={18} weight="bold" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink" title={address}>
            {address}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Not verified yet
          </div>
        </div>
        <button
          type="button"
          onClick={onChange}
          disabled={disabled}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-fill hover:text-ink disabled:opacity-50"
        >
          <PencilSimple size={13} weight="bold" />
          <span className="hidden sm:inline">Use a different email</span>
          <span className="sm:hidden">Change</span>
        </button>
      </div>
    </div>
  );
}
