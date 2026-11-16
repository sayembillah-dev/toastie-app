'use client';

import { EnvelopeSimple, LockKey, Phone, User, UserPlus } from '@phosphor-icons/react/dist/ssr';
import { Alert, App, Button, Form, Input } from 'antd';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { CodeField, ResendCode, useResendCooldown } from '@/components/auth/resend-code';
import { RouteFallback } from '@/components/route-fallback';
import { completeSignIn } from '@/lib/auth/complete-sign-in';
import {
  emailRules,
  fullNameRules,
  normalizePhone,
  passwordRules,
  phoneRules,
} from '@/lib/validation/rules';
import {
  useAuthRegisterMutation,
  useAuthSignupSendCodeMutation,
  useAuthSignupVerifyMutation,
} from '@/store/api';
import { getErrorCode, getFieldErrors, isRateLimited } from '@/store/api-error';
import { useAppDispatch } from '@/store/hooks';

type Step = 'email' | 'code' | 'details';

interface EmailValues {
  email: string;
}

interface CodeValues {
  code: string;
}

interface DetailsValues {
  name: string;
  phone: string;
  password: string;
}

/** Register page — email first, in three steps:
 *
 *  1. Email → a code is sent. The answer is the same whether or not the
 *     address already has an account (that address gets a notice email
 *     instead), so the wording here stays neutral.
 *  2. Code → a 30-minute `signupToken`, held in React state only.
 *  3. Name, mobile number, password → the account, signed in.
 *
 * On success the account is created role-less: the returned session carries
 * `memberships: []` and `orgAssignments: []`, which `AppFrame` recognises and
 * swaps in the onboarding screen. */
function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailForm] = Form.useForm<EmailValues>();
  const [codeForm] = Form.useForm<CodeValues>();
  const [detailsForm] = Form.useForm<DetailsValues>();
  const [sendCode, { isLoading: isSending }] = useAuthSignupSendCodeMutation();
  const [verify, { isLoading: isVerifying }] = useAuthSignupVerifyMutation();
  const [register, { isLoading: isRegistering }] = useAuthRegisterMutation();
  const cooldown = useResendCooldown(60);

  const nextParam = searchParams.get('next');
  const loginHref = nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login';

  async function requestCode(address: string): Promise<boolean> {
    setError(null);
    try {
      await sendCode({ email: address }).unwrap();
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
    if (await requestCode(address)) {
      setEmail(address);
      codeForm.resetFields();
      setStep('code');
    }
  }

  async function onResend() {
    if (await requestCode(email)) message.success('Code sent');
  }

  async function onCode(values: CodeValues) {
    setError(null);
    try {
      const res = await verify({ email, code: values.code }).unwrap();
      setSignupToken(res.signupToken);
      setStep('details');
    } catch (err) {
      if (getErrorCode(err) === 'OTP_INVALID') {
        codeForm.setFields([
          { name: 'code', errors: ['That code is wrong or has expired. Try again or resend.'] },
        ]);
        return;
      }
      setError(
        isRateLimited(err)
          ? 'Too many attempts. Wait a minute and try again.'
          : 'Could not check the code. Please try again.',
      );
    }
  }

  function restart(notice: string | null) {
    setSignupToken(null);
    setStep('email');
    setError(notice);
  }

  async function onDetails(values: DetailsValues) {
    if (!signupToken) {
      restart('Your sign-up timed out. Enter your email to start again.');
      return;
    }
    setError(null);
    try {
      const res = await register({
        signupToken,
        name: values.name.trim(),
        phone: normalizePhone(values.phone),
        password: values.password,
      }).unwrap();
      router.replace(completeSignIn(dispatch, res, nextParam));
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'PHONE_TAKEN') {
        // Same token still works — let them fix the number and resubmit.
        detailsForm.setFields([
          { name: 'phone', errors: ['An account with this mobile number already exists'] },
        ]);
        return;
      }
      if (code === 'SIGNUP_TOKEN_INVALID') {
        restart('Your sign-up timed out. Enter your email to start again.');
        return;
      }
      if (code === 'EMAIL_TAKEN') {
        restart('That email already has an account. Sign in instead, or use another email.');
        return;
      }
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        detailsForm.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: name as keyof DetailsValues,
            errors,
          })),
        );
        return;
      }
      setError(
        isRateLimited(err)
          ? 'Too many attempts. Wait a minute and try again.'
          : 'Registration failed. Please try again.',
      );
    }
  }

  const footer = (
    <>
      Already have an account? <Link href={loginHref}>Sign in</Link>
    </>
  );
  const errorAlert = error ? (
    <Alert type="error" showIcon className="mb-4" message={error} />
  ) : null;

  if (step === 'email') {
    return (
      <AuthShell>
        <AuthCard
          icon={UserPlus}
          title="Create your account"
          subtitle="Start with your email. We'll send you a code."
          footer={footer}
        >
          {errorAlert}
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

  if (step === 'code') {
    return (
      <AuthShell>
        <AuthCard
          icon={EnvelopeSimple}
          title="Check your email"
          subtitle={
            <>
              We sent a code to <span className="font-medium text-ink">{email}</span>. If you
              already have an account, that email has a sign-in link instead.
            </>
          }
          footer={footer}
        >
          {errorAlert}
          <Form<CodeValues>
            form={codeForm}
            layout="vertical"
            onFinish={onCode}
            disabled={isVerifying}
          >
            <CodeField />
            <Form.Item className="!mb-3">
              <Button type="primary" htmlType="submit" block size="large" loading={isVerifying}>
                Continue
              </Button>
            </Form.Item>
          </Form>
          <ResendCode remaining={cooldown.remaining} loading={isSending} onResend={onResend} />
          <button
            type="button"
            onClick={() => restart(null)}
            className="mt-2 w-full text-center text-xs font-medium text-ink-muted hover:text-ink"
          >
            Use a different email
          </button>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        icon={UserPlus}
        title="Almost done"
        subtitle={
          <>
            Signing up as <span className="font-medium text-ink">{email}</span>
          </>
        }
        footer={footer}
      >
        {errorAlert}
        <Form<DetailsValues>
          form={detailsForm}
          layout="vertical"
          onFinish={onDetails}
          disabled={isRegistering}
        >
          <Form.Item label="Full name" name="name" className="!mb-4" rules={fullNameRules()}>
            <Input
              autoComplete="name"
              size="large"
              placeholder="e.g. Sayem Billah"
              prefix={<User size={16} className="text-ink-muted" />}
            />
          </Form.Item>

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

          <Form.Item label="Password" name="password" rules={passwordRules()}>
            <Input.Password
              autoComplete="new-password"
              size="large"
              prefix={<LockKey size={16} className="text-ink-muted" />}
            />
          </Form.Item>

          <Form.Item className="!mb-0">
            <Button type="primary" htmlType="submit" block size="large" loading={isRegistering}>
              Create account
            </Button>
          </Form.Item>
          <p className="mt-3 text-center text-xs text-black/55">
            By creating an account you agree to the{' '}
            <Link href="/terms" target="_blank" className="underline underline-offset-2">
              Terms of use
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">
              Privacy policy
            </Link>
            .
          </p>
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
