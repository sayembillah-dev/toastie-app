'use client';

import { Form, Input } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { codeRules, OTP_LENGTH } from '@/lib/validation/rules';

/** Counts down the server's 60-second resend cooldown. `start()` right after
 * a code goes out; `remaining` is whole seconds left, 0 when a resend is
 * allowed. */
export function useResendCooldown(seconds = 60): { remaining: number; start: () => void } {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) {
        window.clearInterval(id);
        setUntil(null);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [until]);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setUntil(t + seconds * 1000);
  }, [seconds]);

  const remaining = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  return { remaining, start };
}

interface ResendCodeProps {
  remaining: number;
  loading?: boolean;
  onResend: () => void;
}

/** "Resend code" link that waits out the cooldown. */
export function ResendCode({ remaining, loading, onResend }: ResendCodeProps) {
  if (remaining > 0) {
    return (
      <p className="text-center text-xs text-ink-muted">
        You can ask for a new code in {remaining}s
      </p>
    );
  }
  return (
    <p className="text-center text-xs text-ink-muted">
      Didn&rsquo;t get it?{' '}
      <button
        type="button"
        onClick={onResend}
        disabled={loading}
        className="font-medium text-ink underline underline-offset-2 hover:text-ink-soft disabled:opacity-50"
      >
        Resend code
      </button>
    </p>
  );
}

/** The 6-digit code field shared by every one-time-code step. */
export function CodeField({ label = 'Code' }: { label?: string }) {
  return (
    <Form.Item label={label} name="code" rules={codeRules()}>
      <Input.OTP length={OTP_LENGTH} size="large" autoFocus />
    </Form.Item>
  );
}
