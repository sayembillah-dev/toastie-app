'use client';

import { CheckCircle, HandWaving, UserPlus, Warning } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Form, Input, Spin } from 'antd';
import { useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthShell } from '@/components/auth/auth-shell';
import { fullNameRules, normalizePhone, phoneRules } from '@/lib/validation/rules';
import { useGetPublicGuestInviteQuery, useSubmitPublicGuestInviteMutation } from '@/store/api';
import { getApiErrorMessage, getFieldErrors } from '@/store/api-error';

interface GuestInvitePageProps {
  token: string;
}

interface FormValues {
  name: string;
  phone: string;
  organization?: string;
  bio?: string;
}

/** True when the API rejected the submit with a 409 — this club already has a
 * guest on file with that phone number. */
function isAlreadyOnListError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 409
  );
}

/** Public self-signup page at `/guest-invite/:token` — where a visitor lands
 * after scanning the club's invite QR. Only a name and a mobile number are
 * required; where they work / what they do and a short intro are optional
 * extras. Submitting drops them into the club's guest pipeline; no account,
 * no sign-in. The token in the URL is the only credential. */
export function GuestInvitePage({ token }: GuestInvitePageProps) {
  const {
    data: preview,
    isLoading,
    isError,
  } = useGetPublicGuestInviteQuery(token, { skip: !token });
  const [submit, { isLoading: isSubmitting }] = useSubmitPublicGuestInviteMutation();
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  /** First name of the visitor once the submit lands — switches the card to
   * the success state. */
  const [welcomedName, setWelcomedName] = useState<string | null>(null);
  const [alreadyOnList, setAlreadyOnList] = useState(false);

  async function handleSubmit() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      await submit({
        token,
        name: values.name.trim(),
        phone: normalizePhone(values.phone),
        organization: values.organization?.trim() || undefined,
        bio: values.bio?.trim() || undefined,
      }).unwrap();
      setWelcomedName(values.name.trim().split(/\s+/)[0] ?? null);
    } catch (err) {
      if (isAlreadyOnListError(err)) {
        setAlreadyOnList(true);
        return;
      }
      // Server-side DTO failures land on their matching fields (the DTO
      // property names and the Form.Item names line up on purpose).
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        form.setFields(
          Object.entries(fieldErrors).map(([field, errors]) => ({
            name: field as keyof FormValues,
            errors,
          })),
        );
        return;
      }
      message.error(getApiErrorMessage(err, "Couldn't save your details. Please try again."));
    }
  }

  if (isLoading) {
    return (
      <AuthShell>
        <div className="flex justify-center">
          <Spin size="large" />
        </div>
      </AuthShell>
    );
  }

  if (isError || !preview) {
    return (
      <AuthShell>
        <AuthCard
          icon={Warning}
          title="This link isn't valid"
          subtitle="It may have been regenerated. Ask the club for their current invite link or QR code."
        />
      </AuthShell>
    );
  }

  if (alreadyOnList) {
    return (
      <AuthShell>
        <AuthCard
          icon={CheckCircle}
          title="You're already on the list"
          subtitle={`${preview.clubName} already has your number — no need to sign up again. See you at the next meeting!`}
        />
      </AuthShell>
    );
  }

  if (welcomedName) {
    return (
      <AuthShell>
        <AuthCard
          icon={HandWaving}
          title={`See you soon, ${welcomedName}!`}
          subtitle={`You're on the guest list at ${preview.clubName}. Someone from the club will reach out before the next meeting.`}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        icon={UserPlus}
        title={`Visit ${preview.clubName}`}
        subtitle="Thinking of dropping by a meeting? Leave your name and number and the club will be in touch."
        footer="Only your name and number are required — no account needed."
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          disabled={isSubmitting}
          onFinish={handleSubmit}
          className="flex flex-col gap-4"
        >
          <Form.Item
            label="Your name"
            name="name"
            rules={fullNameRules('Your name')}
            className="!mb-0"
          >
            <Input id="guest-invite-name" placeholder="e.g. Jordan Lee" autoFocus />
          </Form.Item>

          <Form.Item
            label="Mobile number"
            name="phone"
            rules={phoneRules()}
            extra="11 digits, e.g. 01568286512"
            className="!mb-0"
          >
            <Input id="guest-invite-phone" placeholder="01XXXXXXXXX" inputMode="numeric" />
          </Form.Item>

          <Form.Item
            label="Organization / profession"
            name="organization"
            extra="Optional — where you work or what you do."
            className="!mb-0"
          >
            <Input
              id="guest-invite-organization"
              placeholder="e.g. Lecturer at BUET, banker, student"
              maxLength={120}
            />
          </Form.Item>

          <Form.Item
            label="A little about you"
            name="bio"
            extra="Optional — helps the club give you a proper welcome."
            className="!mb-0"
          >
            <Input.TextArea
              id="guest-invite-bio"
              rows={3}
              maxLength={600}
              placeholder="What brings you to Toastmasters?"
            />
          </Form.Item>

          <Button type="primary" block size="large" htmlType="submit" loading={isSubmitting}>
            Count me in
          </Button>
        </Form>
      </AuthCard>
    </AuthShell>
  );
}
