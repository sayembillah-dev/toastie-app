'use client';

import { ArrowsClockwise, CheckCircle, Copy, EnvelopeSimple } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Checkbox, Input, Modal, Select } from 'antd';
import { useMemo, useState } from 'react';

import type { OfficerRole } from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
import { generatePassword } from '@/lib/org/password';
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
import { getApiErrorMessage } from '@/store/api-error';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));
const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  new: 'New member',
  existing: 'Existing member',
};
const MEMBER_TYPE_OPTIONS = MEMBER_TYPES.map((type) => ({
  value: type,
  label: MEMBER_TYPE_LABELS[type],
}));
/** Splits a single "Full name" field into the `firstName`/`lastName` pair
 * the backend still stores separately. First word is the first name, the
 * rest (if any) is the last name — matches how every other name field in
 * this app already treats a two-word default. */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1) };
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
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [email, setEmail] = useState('');
  const [tiMemberNumber, setTiMemberNumber] = useState('');

  const [assignOrgRole, setAssignOrgRole] = useState(false);
  const [districtId, setDistrictId] = useState<string | undefined>(undefined);
  const [divisionId, setDivisionId] = useState<string | undefined>(undefined);
  const [areaId, setAreaId] = useState<string | undefined>(undefined);
  const [clubId, setClubId] = useState<string | undefined>(undefined);
  const [roles, setRoles] = useState<OfficerRole[]>([]);
  const [memberType, setMemberType] = useState<MemberType | undefined>(undefined);
  const [isClubAdmin, setIsClubAdmin] = useState(false);

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
    setDistrictId(value);
    setDivisionId(undefined);
    setAreaId(undefined);
    setClubId(undefined);
  }

  function handleDivisionChange(value: string | undefined) {
    setDivisionId(value);
    setDistrictId(value ? divisionsById.get(value)?.districtId : undefined);
    setAreaId(undefined);
    setClubId(undefined);
  }

  function handleAreaChange(value: string | undefined) {
    setAreaId(value);
    if (value) {
      const ancestry = ancestryForArea(value);
      setDivisionId(ancestry.divisionId);
      setDistrictId(ancestry.districtId);
    } else {
      setDivisionId(undefined);
      setDistrictId(undefined);
    }
    setClubId(undefined);
  }

  function handleClubChange(value: string | undefined) {
    setClubId(value);
    if (value) {
      const club = clubsById.get(value);
      setAreaId(club?.areaId);
      const ancestry = club ? ancestryForArea(club.areaId) : undefined;
      setDivisionId(ancestry?.divisionId);
      setDistrictId(ancestry?.districtId);
    } else {
      setAreaId(undefined);
      setDivisionId(undefined);
      setDistrictId(undefined);
    }
  }

  const { firstName, lastName } = splitFullName(fullName);
  const phoneValid = /^\+?[0-9\s-]{8,20}$/.test(phone.trim());
  const passwordValid = password.trim().length >= 12;
  const nameValid = firstName.length > 0 && lastName.length > 0;
  const canSave =
    nameValid &&
    phoneValid &&
    passwordValid &&
    (!assignOrgRole || clubId !== undefined) &&
    !isSubmitting;

  async function handleSave() {
    if (!canSave) return;
    try {
      const result = await createUser({
        phone: phone.trim(),
        password: password.trim(),
        firstName,
        lastName,
        email: email.trim() || undefined,
        tiMemberNumber: tiMemberNumber.trim() || undefined,
        clubId: assignOrgRole ? clubId : undefined,
        roles: assignOrgRole && clubId ? roles : undefined,
        isClubAdmin: assignOrgRole && clubId ? isClubAdmin : undefined,
        memberType: assignOrgRole && clubId ? memberType : undefined,
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cu-full-name" className="text-sm font-medium text-ink">
          Full name
        </label>
        <Input
          id="cu-full-name"
          placeholder="Jane Doe"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-email" className="text-sm font-medium text-ink">
            Email (optional)
          </label>
          <Input
            id="cu-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            suffix={<EnvelopeSimple size={15} className="text-ink-muted" />}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-phone" className="text-sm font-medium text-ink">
            Phone
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
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cu-ti-number" className="text-sm font-medium text-ink">
          TI member number
        </label>
        <Input
          id="cu-ti-number"
          value={tiMemberNumber}
          onChange={(event) => setTiMemberNumber(event.target.value)}
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

      <Checkbox checked={assignOrgRole} onChange={(e) => setAssignOrgRole(e.target.checked)}>
        Place them in the org tree and assign a role now
      </Checkbox>

      {assignOrgRole ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cu-district" className="text-sm font-medium text-ink">
              District
            </label>
            <Select
              id="cu-district"
              className="w-full"
              placeholder="Select a district"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={districtsLoading}
              value={districtId}
              onChange={handleDistrictChange}
              options={districtOptions}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cu-division" className="text-sm font-medium text-ink">
              Division
            </label>
            <Select
              id="cu-division"
              className="w-full"
              placeholder="Select a division"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={divisionsLoading}
              value={divisionId}
              onChange={handleDivisionChange}
              options={divisionOptions}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cu-area" className="text-sm font-medium text-ink">
              Area
            </label>
            <Select
              id="cu-area"
              className="w-full"
              placeholder="Select an area"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={areasLoading}
              value={areaId}
              onChange={handleAreaChange}
              options={areaOptions}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cu-club" className="text-sm font-medium text-ink">
              Club
            </label>
            <Select
              id="cu-club"
              className="w-full"
              placeholder="Select a club"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={clubsLoading}
              value={clubId}
              onChange={handleClubChange}
              options={clubOptions}
            />
          </div>

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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cu-member-type" className="text-sm font-medium text-ink">
              Member type
            </label>
            <Select
              id="cu-member-type"
              className="w-full"
              placeholder="Select a member type"
              allowClear
              value={memberType}
              onChange={(value: MemberType | undefined) => setMemberType(value)}
              options={MEMBER_TYPE_OPTIONS}
            />
          </div>

          <Checkbox checked={isClubAdmin} onChange={(e) => setIsClubAdmin(e.target.checked)}>
            Club Admin — full access to this club
          </Checkbox>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="primary" disabled={!canSave} loading={isSubmitting} onClick={handleSave}>
          Create user
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
