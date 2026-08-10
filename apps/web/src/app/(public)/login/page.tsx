'use client';

import { Alert, Button, Form, Input, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { RouteFallback } from '@/components/route-fallback';
import { safeNextPath } from '@/lib/auth/next-path';
import { writeAccessToken, writeRefreshToken, writeStoredContext } from '@/lib/auth/token-storage';
import { phoneRules } from '@/lib/validation/rules';
import { useAuthLoginMutation } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { defaultRouteForContext, isContextKeyValid, sessionLoaded } from '@/store/session-slice';

import toastieLogo from '../../../../assets/toastie.svg';

const { Title, Text } = Typography;

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

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const res = await login({
        phone: values.phone.trim(),
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
      const code = extractErrorCode(err);
      setError(messageForCode(code));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-muted p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Image src={toastieLogo} alt="" aria-hidden className="h-8 w-auto" priority />
          <span className="text-base font-semibold text-ink">Toastie</span>
        </div>

        <Title level={4} className="!mb-1 !text-ink">
          Sign in
        </Title>
        <Text className="!text-ink-soft">Welcome back.</Text>

        {error ? <Alert type="error" showIcon className="mt-4" message={error} /> : null}

        <Form<FormValues>
          layout="vertical"
          className="mt-6"
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
              placeholder="+1 555 000 0000"
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Enter your password' }]}
          >
            <Input.Password autoComplete="current-password" size="large" />
          </Form.Item>

          <Form.Item className="!mb-2">
            <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
              Sign in
            </Button>
          </Form.Item>
        </Form>

        <Text className="!text-xs !text-ink-muted">
          New to Toastie? <Link href="/register">Create an account</Link>
        </Text>
      </div>
    </div>
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
