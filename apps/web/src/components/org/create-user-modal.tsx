'use client';

import {
  ArrowsClockwise,
  CheckCircle,
  Copy,
  EnvelopeSimple,
  Link as LinkIcon,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Checkbox, Form, Input, Modal, QRCode, Select } from 'antd';
import { useMemo, useState } from 'react';

import type { OfficerRole } from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
import { generatePassword } from '@/lib/org/password';
import {
  emailRules,
  fullNameRules,
  normalizePhone,
  passwordRules,
  phoneRules,
  requiredSelectRule,
} from '@/lib/validation/rules';
import {
  type CreatePlatformUserResult,
  MEMBER_TYPES,
  type MemberType,
  useCreatePlatformUserMutation,
  useListAreasQuery,
  useListDistrictsQuery,
  useListDivisionsQuery,
  useListOrgClubsQuery,
} from '@/store/api';
import { getApiErrorMessage, getFieldErrors } from '@/store/api-error';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));
const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  new: 'New member',
  existing: 'Existing member',
};
const MEMBER_TYPE_OPTIONS = MEMBER_TYPES.map((type) => ({
  value: type,
  label: MEMBER_TYPE_LABELS[type],
}));

interface FormValues {
  fullName: string;
  email?: string;
  phone: string;
  tiMemberNumber?: string;
  password: string;
  assignOrgRole: boolean;
  districtId?: string;
  divisionId?: string;
  areaId?: string;
  clubId?: string;
  roles: OfficerRole[];
  memberType?: MemberType;
  isClubAdmin: boolean;
}

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

/** Super Admin's direct-provision flow. Unlike `InviteModal` (which just
 * records a pending invite for a Club Admin to close by hand later), this
 * creates the account outright — phone + password the SA sets, and
 * optionally a club placement + role assigned in the same step — and hands
 * back a copyable credentials card. There's no email/SMS infrastructure in
 * this app, so "send an invitation" means the SA copies this card and
 * delivers it through whatever channel they already use with the person. */
export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Add a new user" footer={null} destroyOnHidden>
      <ModalBody key={open ? 'open' : 'closed'} onClose={onClose} />
    </Modal>
  );
}

function ModalBody({ onClose }: { onClose: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [created, setCreated] = useState<CreatePlatformUserResult | null>(null);

  const { data: districts, isLoading: districtsLoading } = useListDistrictsQuery();
  const { data: divisions, isLoading: divisionsLoading } = useListDivisionsQuery();
  const { data: areas, isLoading: areasLoading } = useListAreasQuery();
  const { data: clubs, isLoading: clubsLoading } = useListOrgClubsQuery();
  const [createUser, { isLoading: isSubmitting }] = useCreatePlatformUserMutation();

  const divisionsById = useMemo(
    () => new Map((divisions ?? []).map((d) => [d.id, d])),
    [divisions],
  );
  const areasById = useMemo(() => new Map((areas ?? []).map((a) => [a.id, a])), [areas]);
  const clubsById = useMemo(() => new Map((clubs ?? []).map((c) => [c.id, c])), [clubs]);

  /** Ancestry derived from the area up — an area doesn't carry its district
   * on the wire, so it's one hop through `divisions` to get there. */
  function ancestryForArea(areaOrgId: string) {
    const area = areasById.get(areaOrgId);
    const division = area ? divisionsById.get(area.divisionId) : undefined;
    return { divisionId: area?.divisionId, districtId: division?.districtId };
  }

  const assignOrgRole = Form.useWatch('assignOrgRole', form) ?? false;
  const districtId = Form.useWatch('districtId', form);
  const divisionId = Form.useWatch('divisionId', form);
  const areaId = Form.useWatch('areaId', form);
  const clubId = Form.useWatch('clubId', form);

  const districtOptions = useMemo(
    () => (districts ?? []).map((d) => ({ value: d.id, label: d.name })),
    [districts],
  );
  const divisionOptions = useMemo(
    () =>
      (divisions ?? [])
        .filter((d) => !districtId || d.districtId === districtId)
        .map((d) => ({ value: d.id, label: d.name })),
    [divisions, districtId],
  );
  const areaOptions = useMemo(
    () =>
      (areas ?? [])
        .filter((a) => !divisionId || a.divisionId === divisionId)
        .map((a) => ({ value: a.id, label: a.name })),
    [areas, divisionId],
  );
  const clubOptions = useMemo(
    () =>
      (clubs ?? [])
        .filter((c) => !areaId || c.areaId === areaId)
        .map((c) => ({ value: c.id, label: c.name })),
    [clubs, areaId],
  );

  function handleDistrictChange(value: string | undefined) {
    form.setFieldsValue({
      districtId: value,
      divisionId: undefined,
      areaId: undefined,
      clubId: undefined,
    });
  }

  function handleDivisionChange(value: string | undefined) {
    form.setFieldsValue({
      divisionId: value,
      districtId: value ? divisionsById.get(value)?.districtId : undefined,
      areaId: undefined,
      clubId: undefined,
    });
  }

  function handleAreaChange(value: string | undefined) {
    if (value) {
      const ancestry = ancestryForArea(value);
      form.setFieldsValue({
        areaId: value,
        divisionId: ancestry.divisionId,
        districtId: ancestry.districtId,
        clubId: undefined,
      });
    } else {
      form.setFieldsValue({
        areaId: undefined,
        divisionId: undefined,
        districtId: undefined,
        clubId: undefined,
      });
    }
  }

  function handleClubChange(value: string | undefined) {
    if (value) {
      const club = clubsById.get(value);
      const ancestry = club ? ancestryForArea(club.areaId) : undefined;
      form.setFieldsValue({
        clubId: value,
        areaId: club?.areaId,
        divisionId: ancestry?.divisionId,
        districtId: ancestry?.districtId,
      });
    } else {
      form.setFieldsValue({
        clubId: undefined,
        areaId: undefined,
        divisionId: undefined,
        districtId: undefined,
      });
    }
  }

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      const result = await createUser({
        phone: normalizePhone(values.phone),
        password: values.password.trim(),
        // The API splits the single full-name input on the first space.
        name: values.fullName.trim(),
        email: values.email?.trim() || undefined,
        tiMemberNumber: values.tiMemberNumber?.trim() || undefined,
        clubId: values.assignOrgRole ? values.clubId : undefined,
        roles: values.assignOrgRole && values.clubId ? values.roles : undefined,
        isClubAdmin: values.assignOrgRole && values.clubId ? values.isClubAdmin : undefined,
        memberType: values.assignOrgRole && values.clubId ? values.memberType : undefined,
      }).unwrap();
      setCreated(result);
    } catch (err) {
      /* Map the server-side conflict codes onto the fields the user can fix,
       * so a duplicate mobile or email shows a friendly hint below the input
       * instead of a generic top-level toast. */
      const code = extractErrorCode(err);
      if (code === 'PHONE_TAKEN') {
        form.setFields([
          {
            name: 'phone',
            errors: ['An account with that mobile number already exists.'],
          },
        ]);
        return;
      }
      if (code === 'EMAIL_TAKEN') {
        form.setFields([
          {
            name: 'email',
            errors: ['That email is already linked to another account.'],
          },
        ]);
        return;
      }
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        // The form has one `fullName` input — route `name` (and the legacy
        // `firstName`/`lastName` pair) errors back onto it.
        const { name, firstName, lastName, ...rest } = fieldErrors;
        const nameErrors = [...(name ?? []), ...(firstName ?? []), ...(lastName ?? [])];
        form.setFields([
          ...(nameErrors.length > 0 ? [{ name: 'fullName' as const, errors: nameErrors }] : []),
          ...Object.entries(rest).map(([name, errors]) => ({
            name: name as keyof FormValues,
            errors,
          })),
        ]);
        return;
      }
      message.error(getApiErrorMessage(err, "Couldn't create this account. Please try again."));
    }
  }

  if (created) {
    return (
      <CredentialsCard
        result={created}
        password={form.getFieldValue('password')}
        onDone={onClose}
      />
    );
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      disabled={isSubmitting}
      initialValues={{
        fullName: '',
        email: '',
        phone: '',
        tiMemberNumber: '',
        password: generatePassword(),
        assignOrgRole: false,
        roles: [],
        isClubAdmin: false,
      }}
      className="flex flex-col gap-4"
    >
      <Form.Item label="Full name" name="fullName" rules={fullNameRules()} className="!mb-0">
        <Input id="cu-full-name" placeholder="Jane Doe" />
      </Form.Item>

      <div className="grid grid-cols-2 gap-3">
        <Form.Item label="Email (optional)" name="email" rules={emailRules()} className="!mb-0">
          <Input
            id="cu-email"
            type="email"
            suffix={<EnvelopeSimple size={15} className="text-ink-muted" />}
          />
        </Form.Item>
        <Form.Item label="Phone" name="phone" rules={phoneRules()} className="!mb-0">
          <Input id="cu-phone" type="tel" inputMode="tel" placeholder="01568286512" />
        </Form.Item>
      </div>

      <Form.Item
        label="TI member number"
        name="tiMemberNumber"
        rules={[{ max: 40, message: 'Keep it under 40 characters' }]}
        className="!mb-0"
      >
        <Input id="cu-ti-number" />
      </Form.Item>

      <Form.Item
        label="Password"
        name="password"
        rules={passwordRules()}
        extra="At least 8 characters. Shown once after creation — copy it before closing this dialog."
        className="!mb-0"
      >
        <PasswordWithRegenerate
          onRegenerate={() => form.setFieldsValue({ password: generatePassword() })}
        />
      </Form.Item>

      <Form.Item name="assignOrgRole" valuePropName="checked" className="!mb-0">
        <Checkbox>Place them in the org tree and assign a role now</Checkbox>
      </Form.Item>

      {assignOrgRole ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
          <Form.Item label="District" name="districtId" className="!mb-0">
            <Select
              id="cu-district"
              className="w-full"
              placeholder="Select a district"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={districtsLoading}
              onChange={handleDistrictChange}
              options={districtOptions}
            />
          </Form.Item>
          <Form.Item label="Division" name="divisionId" className="!mb-0">
            <Select
              id="cu-division"
              className="w-full"
              placeholder="Select a division"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={divisionsLoading}
              onChange={handleDivisionChange}
              options={divisionOptions}
            />
          </Form.Item>
          <Form.Item label="Area" name="areaId" className="!mb-0">
            <Select
              id="cu-area"
              className="w-full"
              placeholder="Select an area"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={areasLoading}
              onChange={handleAreaChange}
              options={areaOptions}
            />
          </Form.Item>
          <Form.Item
            label="Club"
            name="clubId"
            rules={[requiredSelectRule('Club')]}
            className="!mb-0"
          >
            <Select
              id="cu-club"
              className="w-full"
              placeholder="Select a club"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={clubsLoading}
              onChange={handleClubChange}
              options={clubOptions}
            />
          </Form.Item>

          <Form.Item label="Roles" name="roles" className="!mb-0">
            <Select
              id="cu-roles"
              mode="multiple"
              className="w-full"
              placeholder="Defaults to plain Member"
              options={ROLE_OPTIONS}
            />
          </Form.Item>

          <Form.Item label="Member type" name="memberType" className="!mb-0">
            <Select
              id="cu-member-type"
              className="w-full"
              placeholder="Select a member type"
              allowClear
              options={MEMBER_TYPE_OPTIONS}
            />
          </Form.Item>

          <Form.Item name="isClubAdmin" valuePropName="checked" className="!mb-0">
            <Checkbox>Club Admin — full access to this club</Checkbox>
          </Form.Item>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="primary" loading={isSubmitting} onClick={handleSave}>
          Create user
        </Button>
      </div>
    </Form>
  );
}

function PasswordWithRegenerate({
  value,
  onChange,
  onRegenerate,
}: {
  value?: string;
  onChange?: (value: string) => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input.Password
        id="cu-password"
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <Button
        icon={<ArrowsClockwise size={14} />}
        onClick={onRegenerate}
        title="Generate a new password"
      />
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

  const origin = useMemo(
    () => (typeof window !== 'undefined' && window.location ? window.location.origin : ''),
    [],
  );
  const loginUrl = `${origin}/login`;
  /* Same data the credentials card already shows, on a page the recipient
   * can open themselves — the direct link and QR code both point here.
   * Stops working the moment they log in once (see `AuthService.login`). */
  const credentialsUrl = `${origin}/credentials/${result.id}?t=${encodeURIComponent(result.credentialShare.token)}`;

  const summaryLines = [
    `${result.firstName} ${result.lastName}`,
    `Sign in at: ${loginUrl}`,
    `Mobile: ${result.phone}`,
    `Password: ${password}`,
    result.tiMemberNumber ? `TI member #: ${result.tiMemberNumber}` : null,
    result.clubName ? `Club: ${result.clubName}` : null,
    result.clubName && result.roles.length > 0 ? `Role: ${result.roles.join(', ')}` : null,
    result.clubName && result.memberType
      ? `Member type: ${MEMBER_TYPE_LABELS[result.memberType]}`
      : null,
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

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(credentialsUrl);
      message.success('Link copied');
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
        The password is shown here once. Share it with {result.firstName} however works best — copy
        the text below, send the direct link, or let them scan the QR code.
      </p>

      <pre className="whitespace-pre-wrap rounded-lg border border-line bg-fill px-3 py-2.5 text-xs text-ink">
        {summary}
      </pre>

      <div className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center justify-center rounded-md bg-canvas p-1.5">
          <QRCode value={credentialsUrl} size={104} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-xs font-medium text-ink">Direct link</p>
          <p className="truncate text-xs text-ink-muted" title={credentialsUrl}>
            {credentialsUrl}
          </p>
          <Button size="small" icon={<LinkIcon size={13} />} onClick={handleCopyLink}>
            Copy link
          </Button>
        </div>
      </div>

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
