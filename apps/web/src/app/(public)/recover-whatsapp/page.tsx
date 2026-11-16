'use client';

import { LockKey, Phone, WhatsappLogo } from '@phosphor-icons/react/dist/ssr';
import { Alert, App, Button, Form, Input } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { CodeField, ResendCode, useResendCooldown } from '@/components/auth/resend-code';
import { completeSignIn } from '@/lib/auth/complete-sign-in';
import {
  confirmPasswordRule,
  normalizePhone,
  passwordRules,
  phoneRules,
} from '@/lib/validation/rules';
import {
  useAuthWhatsappRecoveryRequestMutation,
  useAuthWhatsappRecoveryResetMutation,
} from '@/store/api';
import { getErrorCode, getFieldErrors, isRateLimited } from '@/store/api-error';
import { useAppDispatch } from '@/store/hooks';

interface PhoneValues {
  phone: string;
}

interface ResetValues {
  code: string;
  newPassword: string;
  confirmPassword: string;
}

/** Password recovery by WhatsApp, for older accounts with no verified email.
 * Phone → code + new password → signed in. The request step always
 * succeeds (the API never reveals whether the number may use this), so the
 * wording stays neutral. Once signed in the usual gates apply: the session
 * that comes back usually asks for an email next. */
export default function RecoverWhatsappPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const [step, setStep] = useState<'phone' | 'reset'>('phone');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phoneForm] = Form.useForm<PhoneValues>();
  const [resetForm] = Form.useForm<ResetValues>();
  const [requestCode, { isLoading: isSending }] = useAuthWhatsappRecoveryRequestMutation();
  const [reset, { isLoading: isResetting }] = useAuthWhatsappRecoveryResetMutation();
  const cooldown = useResendCooldown(60);

  async function sendCode(number: string): Promise<boolean> {
    setError(null);
    try {
      await requestCode({ phone: number }).unwrap();
      cooldown.start();
      return true;
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors?.phone && step === 'phone') {
        phoneForm.setFields([{ name: 'phone', errors: fieldErrors.phone }]);
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

  async function onPhone(values: PhoneValues) {
    const number = normalizePhone(values.phone);
    if (await sendCode(number)) {
      setPhone(number);
      setStep('reset');
    }
  }

  async function onResend() {
    if (await sendCode(phone)) message.success('Code sent');
  }

  async function onReset(values: ResetValues) {
    setError(null);
    try {
      const res = await reset({
        phone,
        code: values.code,
        newPassword: values.newPassword,
      }).unwrap();
      router.replace(completeSignIn(dispatch, res, null));
    } catch (err) {
      if (getErrorCode(err) === 'OTP_INVALID') {
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
        Have access to your email? <Link href="/forgot-password">Reset by email</Link>
      </div>
      <div>
        Remembered it? <Link href="/login">Sign in</Link>
      </div>
    </div>
  );

  if (step === 'phone') {
    return (
      <AuthShell>
        <AuthCard
          icon={WhatsappLogo}
          title="Get a code on WhatsApp"
          subtitle="For accounts without a verified email. Enter your mobile number."
          footer={footer}
        >
          {error ? <Alert type="error" showIcon className="mb-4" message={error} /> : null}
          <Form<PhoneValues>
            form={phoneForm}
            layout="vertical"
            onFinish={onPhone}
            disabled={isSending}
          >
            <Form.Item label="Mobile number" name="phone" rules={phoneRules()}>
              <Input
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                size="large"
                placeholder="01568286512"
                prefix={<Phone size={16} className="text-ink-muted" />}
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
        icon={WhatsappLogo}
        title="Enter your code"
        subtitle={
          <>
            If <span className="font-medium text-ink">{phone}</span> can use WhatsApp recovery, we
            sent a 6-digit code there.
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
              Set password and sign in
            </Button>
          </Form.Item>
        </Form>
        <ResendCode remaining={cooldown.remaining} loading={isSending} onResend={onResend} />
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep('phone');
          }}
          className="mt-2 w-full text-center text-xs font-medium text-ink-muted hover:text-ink"
        >
          Use a different number
        </button>
      </AuthCard>
    </AuthShell>
  );
}
