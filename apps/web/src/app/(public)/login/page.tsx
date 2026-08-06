'use client';

import { Alert, Button, Form, Input, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { writeAccessToken, writeRefreshToken, writeStoredContext } from '@/lib/auth/token-storage';
import { useAuthLoginMutation } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { isContextKeyValid, sessionLoaded } from '@/store/session-slice';

import toastieLogo from '../../../../assets/toastie.svg';

const { Title, Text } = Typography;

interface FormValues {
  email: string;
  password: string;
}

/** Login page. Public route — `(public)/layout.tsx` renders no shell.
 *
 * On success writes the token pair to localStorage, hydrates the session
 * slice from the returned payload, and pushes into `/` where `AppFrame`
 * picks between dashboard / onboarding based on memberships. Failing
 * calls surface the API's `code` (e.g. `INVALID_CREDENTIALS`) as inline
 * alert copy — no toast, since the form is the only surface here. */
export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useAuthLoginMutation();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const res = await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      }).unwrap();

      writeAccessToken(res.tokens.accessToken);
      writeRefreshToken(res.tokens.refreshToken);

      const contextKey = isContextKeyValid(res.session.defaultContextKey, res.session)
        ? res.session.defaultContextKey
        : null;
      if (contextKey) writeStoredContext(contextKey);

      dispatch(sessionLoaded({ payload: res.session, contextKey }));
      router.replace('/');
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
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input type="email" autoComplete="email" size="large" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Password is required' }]}
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
      return 'Email or password is incorrect.';
    case 'USER_SUSPENDED':
      return 'This account is suspended. Contact an admin.';
    default:
      return 'Sign in failed. Please try again.';
  }
}
