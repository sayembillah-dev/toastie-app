'use client';

import { Form, Input } from 'antd';
import { type ClipboardEvent, useCallback, useEffect, useState } from 'react';

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

/** Pulls the code out of whatever was pasted: "123456", "123 456",
 * "123-456" or a whole "Your code is 123456" line. */
export function digitsOf(text: string): string {
  return text.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

interface CodeFieldProps {
  label?: string;
  /** Submit the surrounding form as soon as all six digits are in, typed
   * or pasted. Only for forms whose sole field is the code. */
  autoSubmit?: boolean;
}

/** The 6-digit code field shared by every one-time-code step.
 *
 * A paste anywhere in the field fills it from the first cell, keeping only
 * the digits — antd's own paste starts at the focused cell and keeps every
 * character. `autoComplete="one-time-code"` lets iOS and Android offer the
 * code from Mail or Messages. */
export function CodeField({ label = 'Code', autoSubmit = false }: CodeFieldProps) {
  const form = Form.useFormInstance();

  function complete() {
    if (autoSubmit) form.submit();
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const digits = digitsOf(event.clipboardData.getData('text'));
    if (digits.length === 0) return;
    event.preventDefault();
    form.setFields([{ name: 'code', value: digits, errors: [] }]);
    if (digits.length === OTP_LENGTH) complete();
  }

  return (
    <div onPasteCapture={onPaste}>
      <Form.Item label={label} name="code" rules={codeRules()}>
        <Input.OTP
          length={OTP_LENGTH}
          size="large"
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          // Fires only when every cell is filled and the value changed.
          onChange={complete}
        />
      </Form.Item>
    </div>
  );
}
