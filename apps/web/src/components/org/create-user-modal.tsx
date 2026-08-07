'use client';

import { ArrowsClockwise, CheckCircle, Copy } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Checkbox, Input, Modal, Select } from 'antd';
import { useMemo, useState } from 'react';

import type { OfficerRole } from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
import {
  type CreatePlatformUserResult,
  useCreatePlatformUserMutation,
  useListOrgClubsQuery,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

function generatePassword(length = 14): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join('');
}

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

/** Super Admin's direct-provision flow. Unlike `InviteModal` (which just
 * records a pending invite for a Club Admin to close by hand later), this
 * creates the account outright — phone + password the SA sets, a club +
 * role assigned in the same step — and hands back a copyable credentials
 * card. There's no email/SMS infrastructure in this app, so "send an
 * invitation" means the SA copies this card and delivers it through
 * whatever channel they already use with the person. */
export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Add a user" footer={null} destroyOnHidden>
      <ModalBody key={open ? 'open' : 'closed'} onClose={onClose} />
    </Modal>
  );
}

function ModalBody({ onClose }: { onClose: () => void }) {
  const { message } = App.useApp();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [email, setEmail] = useState('');
  const [clubId, setClubId] = useState<string | undefined>(undefined);
  const [roles, setRoles] = useState<OfficerRole[]>([]);
  const [isClubAdmin, setIsClubAdmin] = useState(false);

  const [created, setCreated] = useState<CreatePlatformUserResult | null>(null);

  const { data: clubs, isLoading: clubsLoading } = useListOrgClubsQuery();
  const [createUser, { isLoading: isSubmitting }] = useCreatePlatformUserMutation();

  const clubOptions = useMemo(
    () => (clubs ?? []).map((c) => ({ value: c.id, label: c.name })),
    [clubs],
  );

  const phoneValid = /^\+?[0-9\s-]{8,20}$/.test(phone.trim());
  const passwordValid = password.trim().length >= 12;
  const canSave =
    phoneValid &&
    passwordValid &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    !isSubmitting;

  async function handleSave() {
    if (!canSave) return;
    try {
      const result = await createUser({
        phone: phone.trim(),
        password: password.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        clubId,
        roles: clubId ? roles : undefined,
        isClubAdmin: clubId ? isClubAdmin : undefined,
      }).unwrap();
      setCreated(result);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not create this account'));
    }
  }

  if (created) {
    return <CredentialsCard result={created} password={password} onDone={onClose} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-first-name" className="text-sm font-medium text-ink">
            First name
          </label>
          <Input
            id="cu-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-last-name" className="text-sm font-medium text-ink">
            Last name
          </label>
          <Input
            id="cu-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cu-phone" className="text-sm font-medium text-ink">
          Mobile number
        </label>
        <Input
          id="cu-phone"
          type="tel"
          inputMode="tel"
          placeholder="+1 555 000 0000"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          status={phone.length > 0 && !phoneValid ? 'error' : undefined}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cu-password" className="text-sm font-medium text-ink">
          Password
        </label>
        <div className="flex items-center gap-2">
          <Input.Password
            id="cu-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            status={password.length > 0 && !passwordValid ? 'error' : undefined}
          />
          <Button
            icon={<ArrowsClockwise size={14} />}
            onClick={() => setPassword(generatePassword())}
            title="Generate a new password"
          />
        </div>
        <p className="text-xs text-ink-muted">
          At least 12 characters. Shown once after creation — copy it before closing this dialog.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cu-email" className="text-sm font-medium text-ink">
          Email (optional)
        </label>
        <Input
          id="cu-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Club assignment (optional)
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-club" className="text-sm font-medium text-ink">
            Club
          </label>
          <Select
            id="cu-club"
            className="w-full"
            placeholder="No club — account only"
            allowClear
            showSearch
            optionFilterProp="label"
            loading={clubsLoading}
            value={clubId}
            onChange={(value) => setClubId(value)}
            options={clubOptions}
          />
        </div>

        {clubId ? (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cu-roles" className="text-sm font-medium text-ink">
                Roles
              </label>
              <Select
                id="cu-roles"
                mode="multiple"
                className="w-full"
                placeholder="Defaults to plain Member"
                value={roles}
                onChange={(value: OfficerRole[]) => setRoles(value)}
                options={ROLE_OPTIONS}
              />
            </div>
            <Checkbox checked={isClubAdmin} onChange={(e) => setIsClubAdmin(e.target.checked)}>
              Club Admin — full access to this club
            </Checkbox>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="primary" disabled={!canSave} loading={isSubmitting} onClick={handleSave}>
          Create account
        </Button>
      </div>
    </div>
  );
}

function CredentialsCard({
  result,
  password,
  onDone,
}: {
  result: CreatePlatformUserResult;
  password: string;
  onDone: () => void;
}) {
  const { message } = App.useApp();

  const loginUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    return `${origin}/login`;
  }, []);

  const summaryLines = [
    `${result.firstName} ${result.lastName}`,
    `Sign in at: ${loginUrl}`,
    `Mobile: ${result.phone}`,
    `Password: ${password}`,
    result.clubName ? `Club: ${result.clubName}` : null,
    result.clubName && result.roles.length > 0 ? `Role: ${result.roles.join(', ')}` : null,
    result.isClubAdmin ? 'Club Admin: yes' : null,
  ].filter((line): line is string => line !== null);
  const summary = summaryLines.join('\n');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summary);
      message.success('Credentials copied');
    } catch {
      message.error('Could not copy — select the text manually');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-emerald-800">
        <CheckCircle size={18} weight="fill" />
        <p className="text-sm font-medium">Account created</p>
      </div>

      <p className="text-xs text-ink-muted">
        The password is shown here once. Copy these credentials and share them with{' '}
        {result.firstName} directly — there is no automated email or SMS.
      </p>

      <pre className="whitespace-pre-wrap rounded-lg border border-line bg-fill px-3 py-2.5 text-xs text-ink">
        {summary}
      </pre>

      <div className="flex items-center justify-end gap-2">
        <Button icon={<Copy size={14} />} onClick={handleCopy}>
          Copy credentials
        </Button>
        <Button type="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
