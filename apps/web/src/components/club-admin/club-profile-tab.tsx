'use client';

import { Buildings, MapPin, Plus, Trash, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Form, Input, Select, Space } from 'antd';
import { useEffect, useMemo } from 'react';

import {
  CLUB_SOCIAL_PLATFORMS,
  type ClubProfile,
  type ClubSocial,
  type ClubSocialPlatform,
} from '@/lib/club/club-profile';
import { nameRules, textFieldRules, urlRules } from '@/lib/validation/rules';
import { useGetClubProfileQuery, useUpdateClubProfileMutation } from '@/store/api';
import { getApiErrorMessage, getFieldErrors } from '@/store/api-error';

interface FormValues {
  name: string;
  clubNumber?: string;
  motto?: string;
  venueAddress?: string;
  venueMapUrl?: string;
  socials: ClubSocial[];
}

function deserialize(club: ClubProfile): FormValues {
  return {
    name: club.name,
    clubNumber: club.clubNumber ?? '',
    motto: club.motto ?? '',
    venueAddress: club.venueAddress ?? '',
    venueMapUrl: club.venueMapUrl ?? '',
    socials: club.socials.map((social) => ({ ...social })),
  };
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

  const initialValues = useMemo(() => deserialize(club), [club]);

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

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
      await updateClubProfile({
        name: values.name.trim(),
        clubNumber: values.clubNumber?.trim() || null,
        motto: values.motto?.trim() || null,
        venueAddress: values.venueAddress?.trim() || null,
        venueMapUrl: values.venueMapUrl?.trim() || null,
        socials: cleanedSocials,
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
            <Input.TextArea rows={2} maxLength={500} showCount placeholder="Where the club meets" />
          </Form.Item>

          <Form.Item
            label="Google Maps link"
            name="venueMapUrl"
            className="!mb-0"
            rules={urlRules('Google Maps link')}
          >
            <Input placeholder="https://maps.google.com/…" />
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

  return <ClubProfileForm club={club} />;
}
