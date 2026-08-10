'use client';

import { Alert, Button, Form, Input, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { safeNextPath } from '@/lib/auth/next-path';
import { writeAccessToken, writeRefreshToken, writeStoredContext } from '@/lib/auth/token-storage';
import { emailRules, passwordRules, phoneRules, shortNameRules } from '@/lib/validation/rules';
import { useAuthRegisterMutation } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { isContextKeyValid, sessionLoaded } from '@/store/session-slice';

import toastieLogo from '../../../../assets/toastie.svg';

const { Title, Text } = Typography;

interface FormValues {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  email?: string;
}

/** Register page. Sign-up is phone + password (email optional — see
 * project_phone_auth memory). On success the account is created role-less:
 * the returned session carries `memberships: []` and `orgAssignments: []`,
 * which `AppFrame` recognises and swaps in the onboarding screen. */
export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const [register, { isLoading }] = useAuthRegisterMutation();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const trimmedEmail = values.email?.trim();
      const res = await register({
        phone: values.phone.trim(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: trimmedEmail ? trimmedEmail.toLowerCase() : undefined,
      }).unwrap();

      writeAccessToken(res.tokens.accessToken);
      writeRefreshToken(res.tokens.refreshToken);

      const contextKey = isContextKeyValid(res.session.defaultContextKey, res.session)
        ? res.session.defaultContextKey
        : null;
      if (contextKey) writeStoredContext(contextKey);

      dispatch(sessionLoaded({ payload: res.session, contextKey }));
      const next = safeNextPath(searchParams.get('next'));
      router.replace(next ?? '/');
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
          Create your account
        </Title>
        <Text className="!text-ink-soft">
          You&rsquo;ll be able to join or start a club right after signing in.
        </Text>

        {error ? <Alert type="error" showIcon className="mt-4" message={error} /> : null}

        <Form<FormValues>
          layout="vertical"
          className="mt-6"
          onFinish={onSubmit}
          disabled={isLoading}
        >
          <div className="flex gap-3">
            <Form.Item
              label="First name"
              name="firstName"
              className="flex-1 !mb-4"
              rules={shortNameRules('First name')}
            >
              <Input autoComplete="given-name" size="large" />
            </Form.Item>
            <Form.Item
              label="Last name"
              name="lastName"
              className="flex-1 !mb-4"
              rules={shortNameRules('Last name')}
            >
              <Input autoComplete="family-name" size="large" />
            </Form.Item>
          </div>

          <Form.Item label="Mobile number" name="phone" rules={phoneRules()}>
            <Input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              size="large"
              placeholder="+1 555 000 0000"
            />
          </Form.Item>

          <Form.Item label="Email (optional)" name="email" rules={emailRules()}>
            <Input type="email" autoComplete="email" size="large" />
          </Form.Item>

          <Form.Item label="Password" name="password" rules={passwordRules()}>
            <Input.Password autoComplete="new-password" size="large" />
          </Form.Item>

          <Form.Item className="!mb-2">
            <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
              Create account
            </Button>
          </Form.Item>
        </Form>

        <Text className="!text-xs !text-ink-muted">
          Already have an account? <Link href="/login">Sign in</Link>
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
    case 'PHONE_TAKEN':
      return 'An account with that mobile number already exists.';
    case 'EMAIL_TAKEN':
      return 'That email is already linked to another account.';
    default:
      return 'Registration failed. Please try again.';
  }
}
