'use client';

import { EnvelopeSimple, LockKey, Phone, SignIn } from '@phosphor-icons/react/dist/ssr';
import { Alert, Button, Form, Input } from 'antd';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { RouteFallback } from '@/components/route-fallback';
import { completeSignIn } from '@/lib/auth/complete-sign-in';
import { emailRules, normalizePhone, phoneRules } from '@/lib/validation/rules';
import { useAuthLoginMutation } from '@/store/api';
import { getErrorCode, getFieldErrors, isRateLimited } from '@/store/api-error';
import { useAppDispatch } from '@/store/hooks';

type Mode = 'email' | 'phone';

interface FormValues {
  email?: string;
  phone?: string;
  password: string;
}

/** Login page. Public route — `(public)/layout.tsx` renders no shell.
 *
 * Sign-in is email + password. Phone + password stays behind a toggle for
 * older accounts with no verified email; the API answers
 * `403 PHONE_LOGIN_DISABLED` (with the masked email) once an account has
 * one, and this page flips back to email mode with that hint.
 *
 * `?reset=1` is where the forgot-password flow lands after a successful
 * reset. */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useAuthLoginMutation();
  const [mode, setMode] = useState<Mode>('email');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    searchParams.get('reset') === '1' ? 'Password updated. Sign in with your new password.' : null,
  );
  const [form] = Form.useForm<FormValues>();

  const nextParam = searchParams.get('next');
  const withNext = (path: string) =>
    nextParam ? `${path}?next=${encodeURIComponent(nextParam)}` : path;

  function switchMode(to: Mode) {
    setMode(to);
    setError(null);
    form.setFields([
      { name: 'email', errors: [] },
      { name: 'phone', errors: [] },
    ]);
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    setNotice(null);
    try {
      // Built from the mode, not the raw values: antd keeps a hidden field's
      // value, and sending both identifiers is a 400.
      const body =
        mode === 'email'
          ? { email: (values.email ?? '').trim().toLowerCase(), password: values.password }
          : { phone: normalizePhone(values.phone ?? ''), password: values.password };
      const res = await login(body).unwrap();
      router.replace(completeSignIn(dispatch, res, nextParam));
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        form.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: name as keyof FormValues,
            errors,
          })),
        );
        return;
      }
      const code = getErrorCode(err);
      if (code === 'PHONE_LOGIN_DISABLED') {
        const masked = maskedEmailFrom(err);
        setMode('email');
        setNotice(
          masked
            ? `Sign in with your email (${masked}) instead.`
            : 'Sign in with your email instead.',
        );
        return;
      }
      if (isRateLimited(err)) {
        setError('Too many attempts. Wait a minute and try again.');
        return;
      }
      setError(messageForCode(code, mode));
    }
  }

  return (
    <AuthShell>
      <AuthCard
        icon={SignIn}
        title="Sign in"
        subtitle="Welcome back — enter your details to continue."
        footer={
          <>
            New to Openfloor? <Link href={withNext('/register')}>Create account</Link>
          </>
        }
      >
        {notice ? <Alert type="info" showIcon className="mb-4" message={notice} /> : null}
        {error ? <Alert type="error" showIcon className="mb-4" message={error} /> : null}

        <Form<FormValues>
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          autoComplete="on"
          disabled={isLoading}
        >
          {mode === 'email' ? (
            <Form.Item label="Email" name="email" rules={emailRules({ required: true })}>
              <Input
                type="email"
                autoComplete="email"
                size="large"
                placeholder="name@example.com"
                prefix={<EnvelopeSimple size={16} className="text-ink-muted" />}
              />
            </Form.Item>
          ) : (
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
          )}

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Enter your password' }]}
            className="!mb-2"
          >
            <Input.Password
              autoComplete="current-password"
              size="large"
              prefix={<LockKey size={16} className="text-ink-muted" />}
            />
          </Form.Item>

          <div className="mb-5 text-right text-xs">
            <Link href="/forgot-password" className="font-medium text-ink-soft hover:text-ink">
              Forgot password?
            </Link>
          </div>

          <Form.Item className="!mb-3">
            <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
              Sign in
            </Button>
          </Form.Item>

          <button
            type="button"
            onClick={() => switchMode(mode === 'email' ? 'phone' : 'email')}
            className="w-full text-center text-xs font-medium text-ink-muted hover:text-ink"
          >
            {mode === 'email' ? 'Use phone number instead' : 'Use email instead'}
          </button>
        </Form>
      </AuthCard>
    </AuthShell>
  );
}

/** `useSearchParams()` (the `?next=` redirect target) bails out of
 * prerendering, so the Suspense boundary has to wrap the component that reads
 * it rather than live inside it. */
export default function LoginPage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

/** The masked address (`j***@example.com`) that rides along with
 * `403 PHONE_LOGIN_DISABLED`. */
function maskedEmailFrom(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const data = (err as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const email = (data as { email?: unknown }).email;
  return typeof email === 'string' ? email : null;
}

function messageForCode(code: string | null, mode: Mode): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return mode === 'email'
        ? 'Email or password is incorrect.'
        : 'Mobile number or password is incorrect.';
    case 'USER_SUSPENDED':
      return 'This account is suspended. Contact an admin.';
    default:
      return 'Sign in failed. Please try again.';
  }
}
