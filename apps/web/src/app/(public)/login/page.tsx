'use client';

import { LockKey, SignIn, UserCircle } from '@phosphor-icons/react/dist/ssr';
import { Alert, Button, Form, Input } from 'antd';
import type { Rule } from 'antd/es/form';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { RouteFallback } from '@/components/route-fallback';
import { completeSignIn } from '@/lib/auth/complete-sign-in';
import { EMAIL_MAX, normalizePhone, PHONE_REGEX } from '@/lib/validation/rules';
import { useAuthLoginMutation } from '@/store/api';
import { getErrorCode, getFieldErrors, isRateLimited } from '@/store/api-error';
import { useAppDispatch } from '@/store/hooks';

interface FormValues {
  identifier: string;
  password: string;
}

/** Same loose shape antd's `type: 'email'` rule accepts closely enough for a
 * pre-flight check — the API has the final say. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const IDENTIFIER_RULES: Rule[] = [
  {
    validator(_, value) {
      const text = typeof value === 'string' ? value.trim() : '';
      if (text === '') return Promise.reject(new Error('Enter your email or phone number'));
      const ok = text.includes('@')
        ? EMAIL_SHAPE.test(text) && text.length <= EMAIL_MAX
        : PHONE_REGEX.test(normalizePhone(text));
      return ok ? Promise.resolve() : Promise.reject(new Error('Enter your email or phone number'));
    },
  },
];

/** Login page. Public route — `(public)/layout.tsx` renders no shell.
 *
 * One "Email or phone" field: a value with an `@` signs in by email,
 * anything else is normalised as a local mobile number. Accounts that have
 * a verified email can't use their phone any more — the API answers
 * `403 PHONE_LOGIN_DISABLED` with the masked address, and this page names
 * it and clears the field for the email.
 *
 * `?reset=1` is where the forgot-password flow lands after a successful
 * reset. */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useAuthLoginMutation();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    searchParams.get('reset') === '1' ? 'Password updated. Sign in with your new password.' : null,
  );
  const [form] = Form.useForm<FormValues>();

  const nextParam = searchParams.get('next');
  const withNext = (path: string) =>
    nextParam ? `${path}?next=${encodeURIComponent(nextParam)}` : path;

  async function onSubmit(values: FormValues) {
    setError(null);
    setNotice(null);
    const identifier = values.identifier.trim();
    try {
      const body = identifier.includes('@')
        ? { email: identifier.toLowerCase(), password: values.password }
        : { phone: normalizePhone(identifier), password: values.password };
      const res = await login(body).unwrap();
      router.replace(completeSignIn(dispatch, res, nextParam));
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        // The API names the field it got (`email` or `phone`); both live in
        // the one identifier input here.
        const identifierErrors = [...(fieldErrors.email ?? []), ...(fieldErrors.phone ?? [])];
        form.setFields([
          ...(identifierErrors.length > 0
            ? [{ name: 'identifier' as const, errors: identifierErrors }]
            : []),
          ...(fieldErrors.password
            ? [{ name: 'password' as const, errors: fieldErrors.password }]
            : []),
        ]);
        if (identifierErrors.length === 0 && !fieldErrors.password) {
          setError(Object.values(fieldErrors).flat()[0] ?? 'Check your details and try again.');
        }
        return;
      }
      const code = getErrorCode(err);
      if (code === 'PHONE_LOGIN_DISABLED') {
        const masked = maskedEmailFrom(err);
        form.setFieldValue('identifier', '');
        setNotice(
          masked
            ? `This account signs in with email now. Use ${masked}.`
            : 'This account signs in with email now. Use your email address.',
        );
        return;
      }
      if (isRateLimited(err)) {
        setError('Too many attempts. Wait a minute and try again.');
        return;
      }
      setError(messageForCode(code));
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
          <Form.Item label="Email or phone" name="identifier" rules={IDENTIFIER_RULES}>
            <Input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              size="large"
              placeholder="name@example.com or 01XXXXXXXXX"
              prefix={<UserCircle size={16} className="text-ink-muted" />}
            />
          </Form.Item>

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

          <Form.Item className="!mb-0">
            <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
              Sign in
            </Button>
          </Form.Item>
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

function messageForCode(code: string | null): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'Email/phone or password is incorrect.';
    case 'USER_SUSPENDED':
      return 'This account is suspended. Contact an admin.';
    default:
      return 'Sign in failed. Please try again.';
  }
}
