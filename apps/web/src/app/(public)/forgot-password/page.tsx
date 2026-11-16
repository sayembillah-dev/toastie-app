'use client';

import { EnvelopeSimple, Key, LockKey } from '@phosphor-icons/react/dist/ssr';
import { Alert, App, Button, Form, Input } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { CodeField, ResendCode, useResendCooldown } from '@/components/auth/resend-code';
import { confirmPasswordRule, emailRules, passwordRules } from '@/lib/validation/rules';
import { useAuthForgotPasswordMutation, useAuthResetPasswordMutation } from '@/store/api';
import { getErrorCode, getFieldErrors, isRateLimited } from '@/store/api-error';

interface EmailValues {
  email: string;
}

interface ResetValues {
  code: string;
  newPassword: string;
  confirmPassword: string;
}

/** Forgot password: email → code + new password → back to sign in. The
 * request step always succeeds (the API never says whether the email has an
 * account), so the wording stays neutral. Resetting does not sign in. */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emailForm] = Form.useForm<EmailValues>();
  const [resetForm] = Form.useForm<ResetValues>();
  const [requestCode, { isLoading: isSending }] = useAuthForgotPasswordMutation();
  const [resetPassword, { isLoading: isResetting }] = useAuthResetPasswordMutation();
  const cooldown = useResendCooldown(60);

  async function sendCode(address: string): Promise<boolean> {
    setError(null);
    try {
      await requestCode({ email: address }).unwrap();
      cooldown.start();
      return true;
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors?.email && step === 'email') {
        emailForm.setFields([{ name: 'email', errors: fieldErrors.email }]);
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

  async function onEmail(values: EmailValues) {
    const address = values.email.trim().toLowerCase();
    if (await sendCode(address)) {
      setEmail(address);
      setStep('reset');
    }
  }

  async function onResend() {
    if (await sendCode(email)) message.success('Code sent');
  }

  async function onReset(values: ResetValues) {
    setError(null);
    try {
      await resetPassword({ email, code: values.code, newPassword: values.newPassword }).unwrap();
      router.replace('/login?reset=1');
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'OTP_INVALID') {
        resetForm.setFields([
          { name: 'code', errors: ['That code is wrong or has expired. Try again or resend.'] },
        ]);
        return;
      }
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        resetForm.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: name as keyof ResetValues,
            errors,
          })),
        );
        return;
      }
      setError(
        isRateLimited(err)
          ? 'Too many attempts. Wait a minute and try again.'
          : 'Could not reset your password. Please try again.',
      );
    }
  }

  const footer = (
    <div className="space-y-2">
      <div>
        <Link href="/recover-whatsapp">No access to your email? Get a code on WhatsApp</Link>
      </div>
      <div>
        Remembered it? <Link href="/login">Sign in</Link>
      </div>
    </div>
  );

  if (step === 'email') {
    return (
      <AuthShell>
        <AuthCard
          icon={Key}
          title="Reset your password"
          subtitle="Enter your email and we'll send you a code."
          footer={footer}
        >
          {error ? <Alert type="error" showIcon className="mb-4" message={error} /> : null}
          <Form<EmailValues>
            form={emailForm}
            layout="vertical"
            onFinish={onEmail}
            disabled={isSending}
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
        icon={Key}
        title="Enter your code"
        subtitle={
          <>
            If <span className="font-medium text-ink">{email}</span> has an account, we sent a
            6-digit code to it.
          </>
        }
        footer={footer}
      >
        {error ? <Alert type="error" showIcon className="mb-4" message={error} /> : null}
        <Form<ResetValues>
          form={resetForm}
          layout="vertical"
          onFinish={onReset}
          disabled={isResetting}
        >
          <CodeField />
          <Form.Item
            label="New password"
            name="newPassword"
            rules={passwordRules({ label: 'New password' })}
          >
            <Input.Password
              autoComplete="new-password"
              size="large"
              prefix={<LockKey size={16} className="text-ink-muted" />}
            />
          </Form.Item>
          <Form.Item
            label="Confirm new password"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Confirm your new password' },
              confirmPasswordRule('newPassword'),
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              size="large"
              prefix={<LockKey size={16} className="text-ink-muted" />}
            />
          </Form.Item>
          <Form.Item className="!mb-3">
            <Button type="primary" htmlType="submit" block size="large" loading={isResetting}>
              Set new password
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
