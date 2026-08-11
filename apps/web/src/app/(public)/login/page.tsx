'use client';

import { LockKey, Phone, SignIn } from '@phosphor-icons/react/dist/ssr';
import { Alert, Button, Form, Input } from 'antd';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { RouteFallback } from '@/components/route-fallback';
import { safeNextPath } from '@/lib/auth/next-path';
import { writeAccessToken, writeRefreshToken, writeStoredContext } from '@/lib/auth/token-storage';
import { normalizePhone, phoneRules } from '@/lib/validation/rules';
import { useAuthLoginMutation } from '@/store/api';
import { getFieldErrors } from '@/store/api-error';
import { useAppDispatch } from '@/store/hooks';
import { defaultRouteForContext, isContextKeyValid, sessionLoaded } from '@/store/session-slice';

interface FormValues {
  phone: string;
  password: string;
}

/** Login page. Public route — `(public)/layout.tsx` renders no shell.
 *
 * Sign-in is phone + password (email is a contact field, not a credential
 * — see project_phone_auth memory). On success writes the token pair to
 * localStorage, hydrates the session slice, and pushes straight to the
 * caller's default context's own dashboard (`/super-admin` for a Super
 * Admin, `/area` etc. for a Director, `/` for a club member) — `/` itself
 * has no built surface outside a club context, so routing everyone
 * through it first would flash a blank page. */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useAuthLoginMutation();
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const res = await login({
        phone: normalizePhone(values.phone),
        password: values.password,
      }).unwrap();

      writeAccessToken(res.tokens.accessToken);
      writeRefreshToken(res.tokens.refreshToken);

      const contextKey = isContextKeyValid(res.session.defaultContextKey, res.session)
        ? res.session.defaultContextKey
        : null;
      if (contextKey) writeStoredContext(contextKey);

      dispatch(sessionLoaded({ payload: res.session, contextKey }));
      // `next` (e.g. `/invite/:token/accept`) wins over the caller's own
      // context default — an invite link takes someone straight to the
      // accept page regardless of what club they'd otherwise land on.
      const next = safeNextPath(searchParams.get('next'));
      const destination = next ?? (contextKey ? defaultRouteForContext(contextKey) : '/');
      // A temporary (admin-set) password — land on the "set your own"
      // prompt instead, carrying the real destination through so Skip (or
      // a successful change) still lands them where they were headed.
      router.replace(
        res.session.user.mustChangePassword
          ? `/change-password?next=${encodeURIComponent(destination)}`
          : destination,
      );
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
      const code = extractErrorCode(err);
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
            New to Toastie? <Link href="/register">Create an account</Link>
          </>
        }
      >
        {error ? <Alert type="error" showIcon className="mb-4" message={error} /> : null}

        <Form<FormValues>
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          autoComplete="on"
          disabled={isLoading}
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

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Enter your password' }]}
          >
            <Input.Password
              autoComplete="current-password"
              size="large"
              prefix={<LockKey size={16} className="text-ink-muted" />}
            />
          </Form.Item>

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

function extractErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const data = (err as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function messageForCode(code: string | null): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'Mobile number or password is incorrect.';
    case 'USER_SUSPENDED':
      return 'This account is suspended. Contact an admin.';
    default:
      return 'Sign in failed. Please try again.';
  }
}
