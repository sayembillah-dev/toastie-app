'use client';

import { CameraPlus, Plus, Trash, XCircle } from '@phosphor-icons/react/dist/ssr';
import type { UploadFile } from 'antd';
import { App, Button, Checkbox, Drawer, Form, Input, Select, Space, Upload } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import type { Guest, GuestSocial, SocialPlatform } from '@/lib/people/guests';
import { getGuestInitials, getGuestSwatch, SOCIAL_PLATFORMS } from '@/lib/people/guests';
import { uploadFile } from '@/lib/uploads';
import { emailRules, normalizePhone, phoneRules, shortNameRules } from '@/lib/validation/rules';
import { useUpdateGuestMutation } from '@/store/api';
import { getApiErrorMessage, getFieldErrors } from '@/store/api-error';

interface GuestEditPanelProps {
  guest: Guest;
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  whatsappSameAsPhone: boolean;
  whatsapp?: string;
  socials: GuestSocial[];
  bio?: string;
  notes?: string;
  invitedBy?: string;
}

/** Turns the stored Guest into the form's shape. Kept alongside `serialize`
 * below so the two conversions stay symmetrical — a round-trip through this
 * and back must be a no-op. */
function deserialize(guest: Guest): FormValues {
  return {
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    whatsappSameAsPhone: !guest.whatsapp,
    whatsapp: guest.whatsapp ?? '',
    socials: guest.socials?.map((social) => ({ ...social })) ?? [],
    bio: guest.bio ?? '',
    notes: guest.notes ?? '',
    invitedBy: guest.invitedBy ?? '',
  };
}

/** Matches the `guestAvatar` surface cap in
 * `apps/api/src/storage/storage.types.ts`. */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

interface AvatarFieldProps {
  firstName: string;
  lastName: string;
  guestId: string;
  /** Display only: a `blob:` preview of a freshly picked file, or the signed
   * URL the API returned. Never submitted — see `onChange`. */
  value?: string;
  /** `File` when the user picks one, `null` when they clear the photo. The
   * file is uploaded on save and the row stores the resulting object key, so
   * there is no string here that could round-trip back to the server. */
  onChange: (next: File | null) => void;
  onError: (message: string) => void;
}

/** Custom form field for the avatar so the preview lives in-line with the
 * upload / clear controls. antd's Upload is used with `beforeUpload` returning
 * false — the bytes go straight to S3 from `handleSave`, never through antd
 * and never through our API. */
function AvatarField({ firstName, lastName, guestId, value, onChange, onError }: AvatarFieldProps) {
  const swatch = getGuestSwatch(guestId);
  const initials = getGuestInitials({
    firstName: firstName || '?',
    lastName: lastName || '?',
  });

  return (
    <div className="flex items-center gap-4">
      {value ? (
        // biome-ignore lint/performance/noImgElement: blob: preview or a presigned S3 URL whose query string rotates per response — next/image would re-optimise on every render and needs a remote-pattern allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          aria-hidden
          className="size-16 shrink-0 rounded-full object-cover ring-2 ring-line"
        />
      ) : (
        <div
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full ring-2 ring-line"
          style={{ backgroundColor: swatch.bg, color: swatch.fg }}
        >
          <span className="text-lg font-semibold tracking-wide">{initials}</span>
        </div>
      )}

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

const SOCIAL_OPTIONS = SOCIAL_PLATFORMS.map((platform) => ({
  value: platform.id,
  label: platform.label,
}));

const URL_PATTERN = /^(https?:\/\/)?[^\s/$.?#].[^\s]*$/i;

export function GuestEditPanel({ guest, open, onClose }: GuestEditPanelProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [updateGuest, { isLoading }] = useUpdateGuestMutation();

  const initialValues = useMemo(() => deserialize(guest), [guest]);

  /* Re-hydrate the form whenever the drawer re-opens on a new guest, so a
   * discard doesn't leak values from the last session. `destroyOnClose` would
   * work too, but keeping the form mounted lets antd's field-level animations
   * ride the drawer's open transition. */
  useEffect(() => {
    if (open) form.setFieldsValue(initialValues);
  }, [open, form, initialValues]);

  /* The photo sits outside the form for the same reason as on the profile
   * screen: the API hands back a short-lived signed URL and accepts an object
   * key, so there is no single string that can serve as a form value. With
   * neither `pending` nor `cleared` set, save omits `avatarUrl` and the
   * server leaves the existing object alone. */
  const [avatarPending, setAvatarPending] = useState<{ file: File; previewUrl: string } | null>(
    null,
  );
  const [avatarCleared, setAvatarCleared] = useState(false);

  useEffect(() => {
    if (!avatarPending) return;
    return () => URL.revokeObjectURL(avatarPending.previewUrl);
  }, [avatarPending]);

  /* Discard any unsaved photo when the drawer re-opens, so a fresh guest never
   * inherits the previous one's draft. Adjusted during render rather than in
   * an effect — this is state derived from a prop change, and doing it here
   * avoids the extra render pass an effect would cost.
   * https://react.dev/reference/react/useState#storing-information-from-previous-renders */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setAvatarPending(null);
      setAvatarCleared(false);
    }
  }

  const shownAvatar = avatarPending?.previewUrl ?? (avatarCleared ? undefined : guest.avatarUrl);
  const sameAsPhone = Form.useWatch('whatsappSameAsPhone', form);

  const fullName = `${guest.firstName} ${guest.lastName}`;

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    /* Empty strings collapse to `undefined` on the wire so the server clears
     * the field rather than storing `""`. Socials with no URL are dropped —
     * `Add social` seeds an empty row that the club might not fill in. */
    const cleanedSocials = (values.socials ?? [])
      .filter((entry) => entry?.url?.trim())
      .map((entry) => ({ platform: entry.platform, url: entry.url.trim() }));

    let avatarUrl: string | undefined;
    try {
      if (avatarPending) avatarUrl = await uploadFile(avatarPending.file, 'guestAvatar');
      else if (avatarCleared) avatarUrl = '';
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not upload the photo');
      return;
    }

    try {
      await updateGuest({
        guestId: guest.id,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email?.trim() || undefined,
        phone: values.phone ? normalizePhone(values.phone) : undefined,
        whatsapp: values.whatsappSameAsPhone
          ? undefined
          : values.whatsapp
            ? normalizePhone(values.whatsapp)
            : undefined,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        socials: cleanedSocials,
        bio: values.bio?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        invitedBy: values.invitedBy?.trim() || undefined,
      }).unwrap();
      message.success('Guest details saved');
      onClose();
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
      message.error(getApiErrorMessage(err));
    }
  }

  function handleDiscard() {
    form.setFieldsValue(initialValues);
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      /* Wider than the default so the socials row can fit a select + URL side
       * by side; capped at the viewport so a phone gets the whole screen. */
      size="min(520px, 100vw)"
      title={
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-ink">Edit {fullName}</div>
          <div className="text-xs font-normal text-ink-muted">
            Changes save when you submit — Discard leaves the record alone.
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={handleDiscard} disabled={isLoading}>
            Discard
          </Button>
          <Button type="primary" loading={isLoading} onClick={handleSave}>
            Save details
          </Button>
        </div>
      }
      styles={{
        body: { paddingTop: 20, paddingBottom: 20 },
        footer: { padding: '12px 24px' },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        requiredMark="optional"
        disabled={isLoading}
      >
        <Form.Item label="Avatar">
          <AvatarField
            firstName={guest.firstName}
            lastName={guest.lastName}
            guestId={guest.id}
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

        <Form.Item label="Phone" name="phone" rules={phoneRules({ required: false })}>
          <Input placeholder="01568286512" type="tel" inputMode="tel" />
        </Form.Item>

        <Form.Item name="whatsappSameAsPhone" valuePropName="checked" className="!mb-2">
          <Checkbox>WhatsApp is the same as the phone number</Checkbox>
        </Form.Item>

        {!sameAsPhone ? (
          <Form.Item
            label="WhatsApp number"
            name="whatsapp"
            rules={phoneRules({ required: false })}
          >
            <Input placeholder="01568286512" type="tel" inputMode="tel" />
          </Form.Item>
        ) : null}

        <Form.Item label="Socials" className="!mb-4">
          <Form.List name="socials">
            {(fields, { add, remove }) => (
              <div className="flex flex-col gap-2">
                {fields.map(({ key, name, ...restField }) => (
                  /* `key` from Form.List has been unreliable under React 19 —
                   * `name` is the row index and is guaranteed unique per list. */
                  <Space.Compact key={key ?? name} className="w-full items-start !gap-2" block>
                    <Form.Item
                      {...restField}
                      name={[name, 'platform']}
                      noStyle
                      rules={[{ required: true, message: 'Pick a platform' }]}
                    >
                      <Select<SocialPlatform>
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
                        {
                          pattern: URL_PATTERN,
                          message: 'That does not look like a URL',
                        },
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
                  Add social
                </Button>
              </div>
            )}
          </Form.List>
        </Form.Item>

        <Form.Item label="Invited by" name="invitedBy">
          <Input placeholder="Who brought them along?" maxLength={120} />
        </Form.Item>

        <Form.Item label="Bio" name="bio">
          <Input.TextArea
            rows={3}
            maxLength={600}
            showCount
            placeholder="A few sentences the club can jog its memory with."
          />
        </Form.Item>

        <Form.Item label="Notes" name="notes" help="Private — visible to club officers only.">
          <Input.TextArea
            rows={3}
            maxLength={1000}
            showCount
            placeholder="Follow-ups, availability, anything the next officer should know."
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
