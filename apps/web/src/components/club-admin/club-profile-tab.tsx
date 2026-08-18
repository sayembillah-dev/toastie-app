'use client';

import {
  Buildings,
  Image as ImageIcon,
  MapPin,
  Plus,
  Trash,
  UploadSimple,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, ColorPicker, Form, Input, Select, Space, Upload } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { BannerImageFrame } from '@/components/club-admin/banner-image-frame';
import { ReadOnly } from '@/components/permissions/read-only';
import { DEFAULT_BANNER_POS } from '@/lib/club/banner';
import {
  CLUB_SOCIAL_PLATFORMS,
  type ClubBannerPos,
  type ClubProfile,
  type ClubSocial,
  type ClubSocialPlatform,
  type UpdateClubProfileInput,
} from '@/lib/club/club-profile';
import { uploadFile } from '@/lib/uploads';
import {
  nameRules,
  normalizePhone,
  phoneRules,
  textFieldRules,
  urlRules,
} from '@/lib/validation/rules';
import { useGetClubProfileQuery, useUpdateClubProfileMutation } from '@/store/api';
import { getApiErrorMessage, getFieldErrors } from '@/store/api-error';

interface FormValues {
  name: string;
  clubNumber?: string;
  motto?: string;
  venueAddress?: string;
  venueMapUrl?: string;
  contactPhone?: string;
  bannerColor?: string | null;
  socials: ClubSocial[];
}

function deserialize(club: ClubProfile): FormValues {
  return {
    name: club.name,
    clubNumber: club.clubNumber ?? '',
    motto: club.motto ?? '',
    venueAddress: club.venueAddress ?? '',
    venueMapUrl: club.venueMapUrl ?? '',
    contactPhone: club.contactPhone ?? '',
    bannerColor: club.bannerColor ?? null,
    socials: club.socials.map((social) => ({ ...social })),
  };
}

/** Natural w/h of a picked image, decoded from its object URL. A failed
 * decode resolves to 1 (square) rather than blocking the upload — the drag
 * frame then just treats the image as a plain cover fit. */
function readImageAspect(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () =>
      resolve(
        img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1,
      );
    img.onerror = () => resolve(1);
    img.src = url;
  });
}

const SOCIAL_OPTIONS = CLUB_SOCIAL_PLATFORMS.map((platform) => ({
  value: platform.id,
  label: platform.label,
}));

function extractErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const data = (err as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Read-only — area/division/district are set by a District/Division/Area
 * Director placing the club in the org tree, never editable from here. */
function OrganizationSummary({ club }: { club: ClubProfile }) {
  if (!club.areaName) {
    return (
      <p className="text-sm text-ink-muted">
        This club hasn&rsquo;t been placed in an area yet. Once a District/Division/Area officer
        places it, that lineage will show up here.
      </p>
    );
  }

  const lineage = [club.areaName, club.divisionName, club.districtName].filter(Boolean).join(' · ');

  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill text-ink-soft"
      >
        <MapPin size={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{lineage}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Managed by your District/Division/Area leadership, not from this page.
        </p>
      </div>
    </div>
  );
}

function ClubProfileForm({ club }: { club: ClubProfile }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [updateClubProfile, { isLoading }] = useUpdateClubProfileMutation();

  /* Custom agenda banner: the picked file waits locally (same deferred
   * pattern as the profile avatar) and only uploads when Save is pressed,
   * so a discarded selection never touches storage. */
  const [bannerPending, setBannerPending] = useState<{
    file: File;
    previewUrl: string;
    aspect: number;
  } | null>(null);
  const [bannerCleared, setBannerCleared] = useState(false);
  const [bannerPos, setBannerPos] = useState<ClubBannerPos | null>(club.bannerImagePos ?? null);
  const [bannerPosDirty, setBannerPosDirty] = useState(false);

  const initialValues = useMemo(() => deserialize(club), [club]);

  /* This component is keyed on `club.updatedAt` (see ClubProfileTab), so a
   * post-save refetch remounts it: the pending upload clears itself and the
   * wire's fresh signed URL shows — no reset effect needed. */

  useEffect(() => {
    if (!bannerPending) return;
    return () => URL.revokeObjectURL(bannerPending.previewUrl);
  }, [bannerPending]);

  const shownBanner =
    bannerPending?.previewUrl ?? (bannerCleared ? null : (club.bannerImageUrl ?? null));
  const framePos: ClubBannerPos | null = shownBanner
    ? {
        x: bannerPos?.x ?? 50,
        y: bannerPos?.y ?? 50,
        zoom: bannerPos?.zoom ?? 1,
        aspect: bannerPending?.aspect ?? bannerPos?.aspect ?? club.bannerImagePos?.aspect,
      }
    : null;

  async function handleBannerFile(file: File): Promise<boolean> {
    const previewUrl = URL.createObjectURL(file);
    const aspect = await readImageAspect(previewUrl);
    setBannerPending({ file, previewUrl, aspect });
    setBannerCleared(false);
    setBannerPos((prev) => ({ ...(prev ?? DEFAULT_BANNER_POS), aspect }));
    return false; // antd Upload: never auto-POST — Save uploads via uploadFile
  }

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
        platform: entry.platform as ClubSocialPlatform,
        url: entry.url.trim(),
      }));

    try {
      let banner: Pick<UpdateClubProfileInput, 'bannerImage' | 'bannerImagePos'> = {};
      if (bannerPending) {
        const key = await uploadFile(bannerPending.file, 'clubBanner');
        banner = {
          bannerImage: key,
          bannerImagePos: { ...(bannerPos ?? DEFAULT_BANNER_POS), aspect: bannerPending.aspect },
        };
      } else if (bannerCleared) {
        banner = { bannerImage: null, bannerImagePos: null };
      } else if (bannerPosDirty && bannerPos) {
        banner = { bannerImagePos: bannerPos };
      }

      await updateClubProfile({
        name: values.name.trim(),
        clubNumber: values.clubNumber?.trim() || null,
        motto: values.motto?.trim() || null,
        venueAddress: values.venueAddress?.trim() || null,
        venueMapUrl: values.venueMapUrl?.trim() || null,
        contactPhone: values.contactPhone?.trim() ? normalizePhone(values.contactPhone) : null,
        bannerColor: values.bannerColor?.trim() || null,
        socials: cleanedSocials,
        ...banner,
      }).unwrap();
      message.success('Club profile saved');
    } catch (err) {
      const code = extractErrorCode(err);
      if (code === 'CLUB_NUMBER_TAKEN') {
        form.setFields([{ name: 'clubNumber', errors: ['That club number is already in use'] }]);
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
      <header>
        <h1 className="text-xl font-semibold text-ink">Club profile</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          What members and prospects see about your club — name, venue, motto and official links.
        </p>
      </header>

      <ReadOnly resource="club" display="block">
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          requiredMark="optional"
          disabled={isLoading}
        >
          <div className="rounded-xl border border-line bg-canvas p-5">
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Form.Item label="Club name" name="name" rules={nameRules('Club name')}>
                <Input placeholder="Club name" />
              </Form.Item>
              <Form.Item
                label="Club number"
                name="clubNumber"
                rules={textFieldRules({ label: 'Club number', required: false, max: 20 })}
              >
                <Input placeholder="e.g. 1234567" />
              </Form.Item>
            </div>

            <Form.Item
              label="Motto"
              name="motto"
              rules={textFieldRules({ label: 'Motto', required: false, max: 300 })}
            >
              <Input.TextArea rows={2} maxLength={300} showCount placeholder="Your club's motto" />
            </Form.Item>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-canvas p-5">
            <Form.Item
              label="Venue address"
              name="venueAddress"
              rules={textFieldRules({ label: 'Venue address', required: false, max: 500 })}
            >
              <Input.TextArea
                rows={2}
                maxLength={500}
                showCount
                placeholder="Where the club meets"
              />
            </Form.Item>

            <Form.Item
              label="Google Maps link"
              name="venueMapUrl"
              rules={urlRules('Google Maps link')}
            >
              <Input placeholder="https://maps.google.com/…" />
            </Form.Item>

            <Form.Item
              label="Contact phone"
              name="contactPhone"
              className="!mb-0"
              rules={phoneRules({ required: false })}
            >
              <Input placeholder="01568286512" type="tel" inputMode="tel" />
            </Form.Item>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-canvas p-5">
            <Form.Item label="Official social links" className="!mb-0">
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
                          <Select<ClubSocialPlatform>
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
                            ...urlRules('Link'),
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
                      onClick={() => add({ platform: 'website', url: '' })}
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
            <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <ImageIcon size={14} weight="bold" />
              Agenda banner
            </div>
            <p className="mb-4 text-xs text-ink-muted">
              Printed at the top of every meeting agenda PDF. Pick a colour, or upload a custom
              image and drag it into place — when an image is set it wins over the colour.
            </p>

            <Form.Item
              label="Banner colour"
              name="bannerColor"
              className="!mb-4"
              getValueProps={(value: string | null | undefined) => ({ value: value || null })}
              getValueFromEvent={(color: { cleared?: boolean; toHexString?: () => string }) =>
                color?.cleared ? null : (color?.toHexString?.() ?? null)
              }
            >
              <ColorPicker
                format="hex"
                showText
                allowClear
                disabledAlpha
                onClear={() => form.setFieldValue('bannerColor', null)}
              />
            </Form.Item>

            <Form.Item label="Custom banner image" className="!mb-0">
              <div className="flex flex-col gap-3">
                {shownBanner && framePos ? (
                  <BannerImageFrame
                    src={shownBanner}
                    pos={framePos}
                    disabled={isLoading}
                    onChange={(next) => {
                      setBannerPos(next);
                      setBannerPosDirty(true);
                    }}
                  />
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Upload
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    showUploadList={false}
                    beforeUpload={handleBannerFile}
                    disabled={isLoading}
                  >
                    <Button icon={<UploadSimple size={14} weight="bold" />}>
                      {shownBanner ? 'Replace image' : 'Upload image'}
                    </Button>
                  </Upload>
                  {shownBanner ? (
                    <Button
                      type="text"
                      danger
                      icon={<Trash size={14} weight="bold" />}
                      onClick={() => {
                        setBannerPending(null);
                        setBannerCleared(true);
                        setBannerPos(null);
                        setBannerPosDirty(false);
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <span className="text-xs text-ink-muted">
                      Wide images work best — the strip spans the full page width.
                    </span>
                  )}
                </div>
              </div>
            </Form.Item>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-canvas p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <Buildings size={14} weight="bold" />
              Organization
            </div>
            <OrganizationSummary club={club} />
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="primary" size="large" loading={isLoading} onClick={handleSave}>
              Save changes
            </Button>
          </div>
        </Form>
      </ReadOnly>
    </div>
  );
}

function ClubProfileSkeleton() {
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

export function ClubProfileTab() {
  const { data: club, isError, error } = useGetClubProfileQuery();

  if (isError) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load the club profile</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!club) return <ClubProfileSkeleton />;

  // Keyed on `updatedAt`: the refetch after a successful save remounts the
  // form with the fresh wire values (including the banner image's new signed
  // URL) instead of layering reset effects on top.
  return <ClubProfileForm key={club.updatedAt} club={club} />;
}
