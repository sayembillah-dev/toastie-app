'use client';

import { EnvelopeSimple, LockKey, Phone, User, UserPlus } from '@phosphor-icons/react/dist/ssr';
import { Alert, Button, Form, Input } from 'antd';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { RouteFallback } from '@/components/route-fallback';
import { safeNextPath } from '@/lib/auth/next-path';
import { writeAccessToken, writeRefreshToken, writeStoredContext } from '@/lib/auth/token-storage';
import {
  emailRules,
  normalizePhone,
  passwordRules,
  phoneRules,
  shortNameRules,
} from '@/lib/validation/rules';
import { useAuthRegisterMutation } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { isContextKeyValid, sessionLoaded } from '@/store/session-slice';

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
function RegisterPageContent() {
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
        phone: normalizePhone(values.phone),
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
    <AuthShell>
      <AuthCard
        icon={UserPlus}
        title="Create your account"
        subtitle="You’ll be able to join or start a club right after signing in."
        footer={
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        }
      >
        {error ? <Alert type="error" showIcon className="mb-4" message={error} /> : null}

        <Form<FormValues> layout="vertical" onFinish={onSubmit} disabled={isLoading}>
          <div className="flex gap-3">
            <Form.Item
              label="First name"
              name="firstName"
              className="flex-1 !mb-4"
              rules={shortNameRules('First name')}
            >
              <Input
                autoComplete="given-name"
                size="large"
                prefix={<User size={16} className="text-ink-muted" />}
              />
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
              placeholder="01568286512"
              prefix={<Phone size={16} className="text-ink-muted" />}
            />
          </Form.Item>

          <Form.Item label="Email (optional)" name="email" rules={emailRules()}>
            <Input
              type="email"
              autoComplete="email"
              size="large"
              prefix={<EnvelopeSimple size={16} className="text-ink-muted" />}
            />
          </Form.Item>

          <Form.Item label="Password" name="password" rules={passwordRules()}>
            <Input.Password
              autoComplete="new-password"
              size="large"
              prefix={<LockKey size={16} className="text-ink-muted" />}
            />
          </Form.Item>

          <Form.Item className="!mb-0">
            <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
              Create account
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
export default function RegisterPage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <RegisterPageContent />
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
    case 'PHONE_TAKEN':
      return 'An account with that mobile number already exists.';
    case 'EMAIL_TAKEN':
      return 'That email is already linked to another account.';
    default:
      return 'Registration failed. Please try again.';
  }
}
