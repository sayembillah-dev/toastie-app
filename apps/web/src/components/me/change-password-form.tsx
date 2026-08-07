'use client';

import { LockKey, ShieldWarning } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Form, Input } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';

import { useChangePasswordMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  defaultRouteForContext,
  passwordChanged,
  selectActiveContextKey,
  selectSessionUser,
} from '@/store/session-slice';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Self-service password change — reachable any time from the account menu,
 * and where a fresh login lands when the session's `mustChangePassword` is
 * still set (see `LoginPage`). The banner and "Skip for now" link only
 * render in that second case; as a plain settings page it's just a form. */
export function ChangePasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search?.get('next');
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const sessionUser = useAppSelector(selectSessionUser);
  const contextKey = useAppSelector(selectActiveContextKey);
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const mustChange = sessionUser?.mustChangePassword ?? false;
  const destination = next || defaultRouteForContext(contextKey);

  async function onSubmit(values: FormValues) {
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();
      dispatch(passwordChanged());
      message.success('Password updated');
      router.replace(destination);
    } catch (err) {
      const code = extractErrorCode(err);
      form.setFields([
        {
          name: 'currentPassword',
          errors: code === 'INVALID_CREDENTIALS' ? ['Current password is incorrect'] : [],
        },
      ]);
      if (code !== 'INVALID_CREDENTIALS') {
        message.error(getApiErrorMessage(err));
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      {mustChange ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5 text-amber-900">
          <ShieldWarning size={18} weight="fill" className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">You&rsquo;re using a temporary password</p>
            <p className="mt-0.5 text-xs">
              Set your own to keep your account secure — or skip for now and do it later.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-fill text-ink-soft">
          <LockKey size={18} />
        </span>
        <div>
          <h1 className="text-base font-semibold text-ink">Change password</h1>
          <p className="text-xs text-ink-muted">
            Enter your current password to confirm it&rsquo;s you.
          </p>
        </div>
      </div>

      <Form<FormValues> form={form} layout="vertical" onFinish={onSubmit} disabled={isLoading}>
        <Form.Item
          label="Current password"
          name="currentPassword"
          rules={[{ required: true, message: 'Current password is required' }]}
        >
          <Input.Password autoComplete="current-password" size="large" />
        </Form.Item>

        <Form.Item
          label="New password"
          name="newPassword"
          rules={[
            { required: true, message: 'New password is required' },
            { min: 12, message: 'At least 12 characters' },
          ]}
        >
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>

        <Form.Item
          label="Confirm new password"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Confirm your new password' },
            ({ getFieldValue }) => ({
              validator(_rule, value) {
                if (!value || value === getFieldValue('newPassword')) return Promise.resolve();
                return Promise.reject(new Error('Passwords do not match'));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>

        <div className="mt-2 flex items-center gap-2">
          <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
            Update password
          </Button>
        </div>
      </Form>

      {mustChange ? (
        <button
          type="button"
          onClick={() => router.replace(destination)}
          className="mt-3 w-full text-center text-xs font-medium text-ink-muted hover:text-ink"
        >
          Skip for now
        </button>
      ) : null}
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
