'use client';

import { EnvelopeSimple, LockKey, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import { Alert, App, Button, Form, Input } from 'antd';
import { useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { CodeField, ResendCode, useResendCooldown } from '@/components/auth/resend-code';
import { applySessionPayload, useSessionRefresh } from '@/components/session-provider';
import { useSignOut } from '@/lib/auth/use-sign-out';
import { emailRules } from '@/lib/validation/rules';
import { toastlyApi, useAuthEmailSendCodeMutation, useAuthEmailVerifyMutation } from '@/store/api';
import { getErrorCode, getFieldErrors, isRateLimited } from '@/store/api-error';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectSessionUser } from '@/store/session-slice';

interface SendValues {
  email: string;
  currentPassword: string;
}

interface CodeValues {
  code: string;
}

/** The verify-email gate. `AppFrame` renders this in place of the app while
 * `session.user.mustVerifyEmail` is set — no skip, only sign-out. Two steps:
 * email + current password (the email becomes a sign-in credential) → the
 * emailed code. Success returns the fresh session, which clears the flag and
 * lets `AppFrame` render the page the user was on. */
export function VerifyEmailGate() {
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const user = useAppSelector(selectSessionUser);
  const signOut = useSignOut();
  const refreshSession = useSessionRefresh();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sendForm] = Form.useForm<SendValues>();
  const [codeForm] = Form.useForm<CodeValues>();
  const [sendCode, { isLoading: isSending }] = useAuthEmailSendCodeMutation();
  const [verify, { isLoading: isVerifying }] = useAuthEmailVerifyMutation();
  const cooldown = useResendCooldown(60);

  /** Returns true when a code went out. Errors land on the send form while
   * it's showing, otherwise in the alert. */
  async function requestCode(address: string, currentPassword: string): Promise<boolean> {
    setError(null);
    try {
      await sendCode({ email: address, currentPassword }).unwrap();
      cooldown.start();
      return true;
    } catch (err) {
      const code = getErrorCode(err);
      const onForm = step === 'email';
      if (code === 'INVALID_CREDENTIALS' && onForm) {
        sendForm.setFields([{ name: 'currentPassword', errors: ['Password is incorrect'] }]);
        return false;
      }
      if (code === 'EMAIL_TAKEN' && onForm) {
        sendForm.setFields([
          { name: 'email', errors: ['That email is linked to another account'] },
        ]);
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
        sendForm.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: name as keyof SendValues,
            errors,
          })),
        );
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
    const address = values.email.trim().toLowerCase();
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
      // Anything that 403'd while gated is cached as an error — start clean.
      dispatch(toastlyApi.util.resetApiState());
      applySessionPayload(dispatch, session);
      message.success('Email verified');
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'OTP_INVALID') {
        codeForm.setFields([
          { name: 'code', errors: ['That code is wrong or has expired. Try again or resend.'] },
        ]);
        return;
      }
      if (code === 'EMAIL_TAKEN') {
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

  const footer = (
    <>
      Not you?{' '}
      <button
        type="button"
        onClick={() => void signOut()}
        className="font-medium text-ink underline underline-offset-2 hover:text-ink-soft"
      >
        Sign out
      </button>
    </>
  );
  const errorAlert = error ? (
    <Alert type="error" showIcon className="mb-4" message={error} />
  ) : null;

  if (step === 'email') {
    return (
      <AuthShell>
        <AuthCard
          icon={ShieldCheck}
          title="Verify your email"
          subtitle="You'll use this email to sign in. Confirm it to keep using Openfloor."
          footer={footer}
        >
          {errorAlert}
          <Form<SendValues>
            form={sendForm}
            layout="vertical"
            onFinish={onSend}
            disabled={isSending}
            initialValues={{ email: user?.email ?? '' }}
          >
            <Form.Item label="Email" name="email" rules={emailRules({ required: true })}>
              <Input
                type="email"
                autoComplete="email"
                size="large"
                placeholder="name@example.com"
                prefix={<EnvelopeSimple size={16} className="text-ink-muted" />}
              />
            </Form.Item>
            <Form.Item
              label="Current password"
              name="currentPassword"
              rules={[{ required: true, message: 'Enter your password' }]}
            >
              <Input.Password
                autoComplete="current-password"
                size="large"
                prefix={<LockKey size={16} className="text-ink-muted" />}
              />
            </Form.Item>
            <Form.Item className="!mb-0">
              <Button type="primary" htmlType="submit" block size="large" loading={isSending}>
                Send code
              </Button>
            </Form.Item>
          </Form>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        icon={EnvelopeSimple}
        title="Check your email"
        subtitle={
          <>
            We sent a code to <span className="font-medium text-ink">{email}</span>.
          </>
        }
        footer={footer}
      >
        {errorAlert}
        <Form<CodeValues>
          form={codeForm}
          layout="vertical"
          onFinish={onVerify}
          disabled={isVerifying}
        >
          <CodeField />
          <Form.Item className="!mb-3">
            <Button type="primary" htmlType="submit" block size="large" loading={isVerifying}>
              Verify
            </Button>
          </Form.Item>
        </Form>
        <ResendCode remaining={cooldown.remaining} loading={isSending} onResend={onResend} />
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep('email');
          }}
          className="mt-2 w-full text-center text-xs font-medium text-ink-muted hover:text-ink"
        >
          Use a different email
        </button>
      </AuthCard>
    </AuthShell>
  );
}
