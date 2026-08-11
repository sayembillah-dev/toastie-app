'use client';

import {
  CameraPlus,
  LockKey,
  Path,
  Plus,
  Trash,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react/dist/ssr';
import type { UploadFile } from 'antd';
import { App, Button, Form, Input, Select, Space, Upload } from 'antd';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PushNotificationToggle } from '@/components/push/push-notification-toggle';
import { PersonAvatar } from '@/components/ui/person-avatar';
import {
  getProfileInitials,
  PROFILE_SOCIAL_PLATFORMS,
  type Profile,
  type ProfileSocial,
  type ProfileSocialPlatform,
} from '@/lib/profile/profile';
import { uploadFile } from '@/lib/uploads';
import { emailRules, normalizePhone, phoneRules, shortNameRules } from '@/lib/validation/rules';
import { useGetMyProfileQuery, useUpdateMyProfileMutation } from '@/store/api';
import { getApiErrorMessage, getFieldErrors } from '@/store/api-error';
import { useAppDispatch } from '@/store/hooks';
import { profileUpdated } from '@/store/session-slice';

interface FormValues {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  // Deliberately not a form field: the photo is a `File` held in component
  // state until save, because what the API returns is a signed URL and what
  // it accepts is an object key — the two are not the same string.
  bio?: string;
  socials: ProfileSocial[];
  currentPassword?: string;
}

function deserialize(profile: Profile): FormValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email ?? '',
    phone: profile.phone,
    bio: profile.bio ?? '',
    socials: profile.socials.map((social) => ({ ...social })),
  };
}

/** Matches the `avatar` surface cap in
 * `apps/api/src/storage/storage.types.ts`. */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const AVATAR_PALETTE = [
  { bg: '#FFE4E6', fg: '#881337' },
  { bg: '#FEF3C7', fg: '#78350F' },
  { bg: '#ECFCCB', fg: '#365314' },
  { bg: '#D1FAE5', fg: '#064E3B' },
  { bg: '#CFFAFE', fg: '#164E63' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#E0E7FF', fg: '#312E81' },
  { bg: '#EDE9FE', fg: '#4C1D95' },
  { bg: '#FAE8FF', fg: '#701A75' },
  { bg: '#FCE7F3', fg: '#831843' },
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface AvatarFieldProps {
  profile: Profile;
  /** What to show: a `blob:` preview of a freshly picked file, the signed URL
   * the API returned, or nothing. Display only — never submitted. */
  value?: string;
  /** `File` when the user picks one, `null` when they clear the photo. */
  onChange: (next: File | null) => void;
  onError: (message: string) => void;
}

/** Same convention as `GuestEditPanel`'s `AvatarField`. The picked file is
 * held, not read: it is uploaded to S3 on save, and what lands on the row is
 * an object key. `value` is strictly for display — the URL the API hands back
 * is a short-lived signed one, so submitting it back would be meaningless. */
function AvatarField({ profile, value, onChange, onError }: AvatarFieldProps) {
  const swatch = AVATAR_PALETTE[hashString(profile.id) % AVATAR_PALETTE.length];
  const initials = getProfileInitials(profile);

  return (
    <div className="flex items-center gap-4">
      {/* `value` is a local blob: preview while a new photo is pending, and
       * the signed URL from the API otherwise — PersonAvatar takes either. */}
      <PersonAvatar
        src={value}
        initials={initials}
        swatch={swatch}
        sizeClass="size-16"
        textClass="text-lg tracking-wide"
        className="ring-2 ring-line"
      />

      <div className="flex flex-wrap gap-2">
        <Upload
          accept="image/*"
          showUploadList={false}
          maxCount={1}
          beforeUpload={(file: UploadFile & File) => {
            if (file.size && file.size > AVATAR_MAX_BYTES) {
              const mb = (AVATAR_MAX_BYTES / (1024 * 1024)).toFixed(0);
              onError(`Please choose an image smaller than ${mb} MB.`);
              return Upload.LIST_IGNORE;
            }
            onChange(file);
            return false;
          }}
        >
          <Button icon={<CameraPlus size={14} weight="bold" />} size="middle">
            {value ? 'Change photo' : 'Upload photo'}
          </Button>
        </Upload>
        {value ? (
          <Button
            type="text"
            size="middle"
            onClick={() => onChange(null)}
            icon={<XCircle size={14} weight="bold" />}
            className="!text-ink-soft"
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const SOCIAL_OPTIONS = PROFILE_SOCIAL_PLATFORMS.map((platform) => ({
  value: platform.id,
  label: platform.label,
}));

const URL_PATTERN = /^(https?:\/\/)?[^\s/$.?#].[^\s]*$/i;

function extractErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const data = (err as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Read-only — pathway/level stay editable only through the Education
 * module, never from here. */
function PathwaySummary({ memberships }: { memberships: Profile['memberships'] }) {
  if (memberships.length === 0) {
    return (
      <p className="text-sm text-ink-muted">You&rsquo;re not an active member of any club yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {memberships.map((membership) => (
        <div
          key={membership.clubId}
          className="flex items-center justify-between gap-3 rounded-lg bg-fill/60 px-3.5 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{membership.clubName}</p>
            <p className="text-xs text-ink-soft">
              {membership.pathway
                ? `${membership.pathway}${membership.level ? ` · Level ${membership.level} of 5` : ''}`
                : 'No pathway started yet'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [updateProfile, { isLoading }] = useUpdateMyProfileMutation();
  const dispatch = useAppDispatch();

  const initialValues = useMemo(() => deserialize(profile), [profile]);

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  /* The photo lives outside the form. `pending` is a file the user picked but
   * has not saved (shown from a local `blob:` URL); `cleared` records that
   * they hit Remove. With neither set the field is untouched, and save omits
   * `avatarUrl` entirely so the server leaves the existing object alone —
   * sending back the signed URL it gave us would be rejected as a key. */
  const [avatarPending, setAvatarPending] = useState<{ file: File; previewUrl: string } | null>(
    null,
  );
  const [avatarCleared, setAvatarCleared] = useState(false);

  useEffect(() => {
    if (!avatarPending) return;
    return () => URL.revokeObjectURL(avatarPending.previewUrl);
  }, [avatarPending]);

  const shownAvatar = avatarPending?.previewUrl ?? (avatarCleared ? undefined : profile.avatarUrl);

  const email = Form.useWatch('email', form);
  const phone = Form.useWatch('phone', form);

  const emailChanged = (email ?? '').trim() !== (profile.email ?? '');
  const phoneChanged = (phone ?? '').trim() !== profile.phone;
  const credentialChanged = emailChanged || phoneChanged;

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const cleanedSocials = (values.socials ?? [])
      .filter((entry) => entry?.url?.trim())
      .map((entry) => ({
        platform: entry.platform as ProfileSocialPlatform,
        url: entry.url.trim(),
      }));

    // Upload first: if S3 rejects the photo we stop here rather than saving a
    // profile that points at nothing.
    let avatarUrl: string | undefined;
    try {
      if (avatarPending) avatarUrl = await uploadFile(avatarPending.file, 'avatar');
      else if (avatarCleared) avatarUrl = '';
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not upload the photo');
      return;
    }

    try {
      const result = await updateProfile({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        bio: values.bio?.trim() || undefined,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        socials: cleanedSocials,
        ...(emailChanged ? { email: values.email?.trim() || '' } : {}),
        ...(phoneChanged ? { phone: normalizePhone(values.phone) } : {}),
        ...(credentialChanged ? { currentPassword: values.currentPassword } : {}),
      }).unwrap();
      dispatch(
        profileUpdated({
          firstName: result.firstName,
          lastName: result.lastName,
          email: result.email,
          phone: result.phone,
          avatarUrl: result.avatarUrl,
        }),
      );
      form.setFieldValue('currentPassword', undefined);
      // The saved photo now comes back down through `profile`, so drop the
      // local draft rather than keep showing the stale blob preview.
      setAvatarPending(null);
      setAvatarCleared(false);
      message.success('Profile saved');
    } catch (err) {
      const code = extractErrorCode(err);
      if (code === 'INVALID_CREDENTIALS') {
        form.setFields([{ name: 'currentPassword', errors: ['Current password is incorrect'] }]);
        return;
      }
      if (code === 'EMAIL_TAKEN') {
        form.setFields([{ name: 'email', errors: ['That email is already in use'] }]);
        return;
      }
      if (code === 'PHONE_TAKEN') {
        form.setFields([{ name: 'phone', errors: ['That phone number is already in use'] }]);
        return;
      }
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
      message.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Your profile</h1>
          <p className="mt-0.5 text-sm text-ink-soft">Update how you appear across Toastie.</p>
        </div>
        <Link href="/change-password">
          <Button icon={<LockKey size={14} weight="bold" />}>Change password</Button>
        </Link>
      </header>

      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        requiredMark="optional"
        disabled={isLoading}
      >
        <div className="rounded-xl border border-line bg-canvas p-5">
          <Form.Item label="Photo" className="!mb-0">
            <AvatarField
              profile={profile}
              value={shownAvatar ?? undefined}
              onChange={(next) => {
                if (next) {
                  setAvatarPending({ file: next, previewUrl: URL.createObjectURL(next) });
                  setAvatarCleared(false);
                } else {
                  setAvatarPending(null);
                  setAvatarCleared(true);
                }
              }}
              onError={(msg) => message.error(msg)}
            />
          </Form.Item>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-canvas p-5">
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item label="First name" name="firstName" rules={shortNameRules('First name')}>
              <Input placeholder="First name" />
            </Form.Item>
            <Form.Item label="Last name" name="lastName" rules={shortNameRules('Last name')}>
              <Input placeholder="Last name" />
            </Form.Item>
          </div>

          <Form.Item label="Email" name="email" rules={emailRules()}>
            <Input placeholder="name@example.com" type="email" />
          </Form.Item>

          <Form.Item label="Phone" name="phone" rules={phoneRules()}>
            <Input placeholder="01568286512" type="tel" inputMode="tel" />
          </Form.Item>

          {credentialChanged ? (
            <>
              <Form.Item
                label="Current password"
                name="currentPassword"
                rules={[{ required: true, message: 'Enter your current password to confirm' }]}
                className="!mb-1"
              >
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              <p className="text-xs text-ink-muted">
                Required to confirm an email or phone number change.
              </p>
            </>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl border border-line bg-canvas p-5">
          <Form.Item label="Bio" name="bio" className="!mb-0">
            <Input.TextArea
              rows={3}
              maxLength={1000}
              showCount
              placeholder="A few sentences other members can get to know you by."
            />
          </Form.Item>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-canvas p-5">
          <Form.Item label="Social links" className="!mb-0">
            <Form.List name="socials">
              {(fields, { add, remove }) => (
                <div className="flex flex-col gap-2">
                  {fields.map(({ key, name, ...restField }) => (
                    <Space.Compact key={key ?? name} className="w-full items-start !gap-2" block>
                      <Form.Item
                        {...restField}
                        name={[name, 'platform']}
                        noStyle
                        rules={[{ required: true, message: 'Pick a platform' }]}
                      >
                        <Select<ProfileSocialPlatform>
                          options={SOCIAL_OPTIONS}
                          placeholder="Platform"
                          className="!w-40 shrink-0"
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'url']}
                        noStyle
                        rules={[
                          { required: true, message: 'URL is required' },
                          { pattern: URL_PATTERN, message: 'That does not look like a URL' },
                        ]}
                      >
                        <Input placeholder="https://…" className="!flex-1" />
                      </Form.Item>
                      <Button
                        type="text"
                        onClick={() => remove(name)}
                        aria-label="Remove this social link"
                        icon={<Trash size={14} weight="bold" />}
                        className="!shrink-0 !text-ink-muted"
                      />
                    </Space.Compact>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ platform: 'linkedin', url: '' })}
                    icon={<Plus size={14} weight="bold" />}
                    block
                  >
                    Add social link
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-canvas p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Path size={14} weight="bold" />
            Current pathway
          </div>
          <PathwaySummary memberships={profile.memberships} />
          <p className="mt-2 text-xs text-ink-muted">
            Pathway and level are managed from the Education tab.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="primary" size="large" loading={isLoading} onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </Form>

      <PushNotificationToggle />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4" aria-hidden>
      <div className="h-7 w-40 animate-pulse rounded bg-fill-strong" />
      {Array.from({ length: 4 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
        <div key={index} className="h-24 animate-pulse rounded-xl border border-line bg-fill" />
      ))}
    </div>
  );
}

export function ProfileScreen() {
  const { data: profile, isError, error } = useGetMyProfileQuery();

  if (isError) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load your profile</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!profile) return <ProfileSkeleton />;

  return <ProfileForm profile={profile} />;
}
