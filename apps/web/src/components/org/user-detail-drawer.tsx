'use client';

import {
  ArrowsClockwise,
  CheckCircle,
  Copy,
  Crown,
  Plus,
  Trash,
} from '@phosphor-icons/react/dist/ssr';
import {
  App,
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Tag,
} from 'antd';
import { useMemo, useState } from 'react';

import { PersonAvatar } from '@/components/ui/person-avatar';
import { OFFICER_ROLES, type OfficerRole } from '@/lib/education/members';
import { generatePassword } from '@/lib/org/password';
import { emailRules, fullNameRules, normalizePhone, phoneRules } from '@/lib/validation/rules';
import {
  MEMBER_TYPES,
  type MemberType,
  type PlatformUser,
  type PlatformUserMembership,
  type PlatformUserOrgAssignment,
  useAddPlatformUserMembershipMutation,
  useAddPlatformUserOrgAssignmentMutation,
  useGetPlatformUserMembershipsQuery,
  useGetPlatformUserOrgAssignmentsQuery,
  useListAreasQuery,
  useListDistrictsQuery,
  useListDivisionsQuery,
  useListOrgClubsQuery,
  useRemovePlatformUserOrgAssignmentMutation,
  useResetPlatformUserPasswordMutation,
  useSetPlatformUserAdminMutation,
  useSetPlatformUserStatusMutation,
  useUpdatePlatformUserMembershipMutation,
  useUpdatePlatformUserProfileMutation,
} from '@/store/api';
import { getApiErrorMessage, getFieldErrors } from '@/store/api-error';
import { useAppSelector } from '@/store/hooks';
import { selectSessionUser } from '@/store/session-slice';

import { getInitials } from './super-admin-users-screen';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));
const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  new: 'New member',
  existing: 'Existing member',
};
const MEMBER_TYPE_OPTIONS = MEMBER_TYPES.map((type) => ({
  value: type,
  label: MEMBER_TYPE_LABELS[type],
}));

const DIRECTOR_LEVELS = [
  { value: 'district', label: 'District', role: 'DistrictDirector' as const },
  { value: 'division', label: 'Division', role: 'DivisionDirector' as const },
  { value: 'area', label: 'Area', role: 'AreaDirector' as const },
] as const;
type DirectorLevel = (typeof DIRECTOR_LEVELS)[number]['value'];

function rolesEqual(a: readonly OfficerRole[], b: readonly OfficerRole[]): boolean {
  return a.length === b.length && a.every((role) => b.includes(role));
}

interface UserDetailDrawerProps {
  user: PlatformUser | null;
  open: boolean;
  onClose: () => void;
}

/** The Super Admin's full "edit this person" panel — profile fields,
 * password reset, cross-club memberships and org-tree Director
 * assignments, opened by clicking a row on the Users screen. The row's
 * "Manage" dropdown still covers quick suspend/promote without opening
 * this; those same actions live in here too, under Account, so the panel
 * really does have everything in one place. */
export function UserDetailDrawer({ user, open, onClose }: UserDetailDrawerProps) {
  // Antd's close animation needs the drawer to keep rendering its last
  // content while `open` goes false — by then the parent may have already
  // cleared `user` to null, so mirror it into state that only follows
  // non-null updates ("adjust state during render", not an effect).
  const [lastUser, setLastUser] = useState(user);
  if (user && user !== lastUser) setLastUser(user);

  if (!lastUser) return null;
  return <DrawerBody key={lastUser.id} user={lastUser} open={open} onClose={onClose} />;
}

function DrawerBody({
  user,
  open,
  onClose,
}: {
  user: PlatformUser;
  open: boolean;
  onClose: () => void;
}) {
  const sessionUser = useAppSelector(selectSessionUser);
  const isSelf = sessionUser?.id === user.id;
  // Mirrors the server's own return value after every account-level
  // mutation, so the header tags and Account section stay live without
  // re-deriving from the (possibly stale, page-scoped) list behind this
  // drawer.
  const [liveUser, setLiveUser] = useState(user);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size="min(560px, 100vw)"
      title={
        <div className="flex items-center gap-3">
          <PersonAvatar src={liveUser.avatarUrl} initials={getInitials(liveUser)} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-semibold text-ink">
                {liveUser.firstName} {liveUser.lastName}
              </span>
              {liveUser.isSuperAdmin ? (
                <Tag color="gold" icon={<Crown size={11} weight="fill" />}>
                  Super Admin
                </Tag>
              ) : null}
              {liveUser.status === 'suspended' ? <Tag color="default">Suspended</Tag> : null}
              {isSelf ? <Tag color="blue">You</Tag> : null}
            </div>
            <div className="text-xs font-normal text-ink-muted">{liveUser.phone}</div>
          </div>
        </div>
      }
      footer={null}
      styles={{ body: { paddingTop: 20, paddingBottom: 24 } }}
    >
      <div className="flex flex-col gap-6">
        <Section title="Profile">
          <ProfileSection user={liveUser} onSaved={setLiveUser} />
        </Section>

        <Section title="Account">
          <AccountSection user={liveUser} isSelf={isSelf} onChanged={setLiveUser} />
        </Section>

        <Section title="Password">
          <PasswordSection userId={liveUser.id} firstName={liveUser.firstName} />
        </Section>

        <Section title="Club memberships">
          <MembershipsSection userId={liveUser.id} />
        </Section>

        <Section title="Org-tree Director roles">
          <OrgAssignmentsSection userId={liveUser.id} />
        </Section>
      </div>
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

/* --------------------------------------------------------- profile -- */

interface ProfileValues {
  /** Single "Full name" input — the API splits it on the first space. */
  name: string;
  email: string;
  phone: string;
  tiMemberNumber: string;
}

function ProfileSection({
  user,
  onSaved,
}: {
  user: PlatformUser;
  onSaved: (user: PlatformUser) => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileValues>();
  const [updateProfile, { isLoading }] = useUpdatePlatformUserProfileMutation();

  async function handleSave() {
    let values: ProfileValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      const updated = await updateProfile({
        userId: user.id,
        name: values.name.trim(),
        email: values.email.trim() || undefined,
        phone: normalizePhone(values.phone),
        tiMemberNumber: values.tiMemberNumber.trim() || undefined,
      }).unwrap();
      onSaved(updated);
      message.success('Profile saved');
    } catch (err) {
      const code = extractErrorCode(err);
      if (code === 'PHONE_TAKEN') {
        form.setFields([{ name: 'phone', errors: ['That mobile number is already in use.'] }]);
        return;
      }
      if (code === 'EMAIL_TAKEN') {
        form.setFields([{ name: 'email', errors: ['That email is already in use.'] }]);
        return;
      }
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        form.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: name as keyof ProfileValues,
            errors,
          })),
        );
        return;
      }
      message.error(getApiErrorMessage(err, "Couldn't save these changes. Please try again."));
    }
  }

  return (
    <Form<ProfileValues>
      form={form}
      layout="vertical"
      disabled={isLoading}
      initialValues={{
        name: [user.firstName, user.lastName].filter(Boolean).join(' '),
        email: user.email ?? '',
        phone: user.phone,
        tiMemberNumber: user.tiMemberNumber ?? '',
      }}
      className="flex flex-col gap-3"
    >
      <Form.Item label="Full name" name="name" rules={fullNameRules()} className="!mb-0">
        <Input id="ud-name" placeholder="e.g. Jane Doe" />
      </Form.Item>
      <Form.Item label="Email" name="email" rules={emailRules()} className="!mb-0">
        <Input id="ud-email" type="email" />
      </Form.Item>
      <Form.Item label="Phone" name="phone" rules={phoneRules()} className="!mb-0">
        <Input id="ud-phone" type="tel" inputMode="tel" />
      </Form.Item>
      <Form.Item
        label="TI member number"
        name="tiMemberNumber"
        rules={[{ max: 40, message: 'Keep it under 40 characters' }]}
        className="!mb-0"
      >
        <Input id="ud-ti-number" />
      </Form.Item>
      <div className="flex justify-end">
        <Button type="primary" size="small" loading={isLoading} onClick={handleSave}>
          Save profile
        </Button>
      </div>
    </Form>
  );
}

function extractErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const data = (err as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/* --------------------------------------------------------- account -- */

function AccountSection({
  user,
  isSelf,
  onChanged,
}: {
  user: PlatformUser;
  isSelf: boolean;
  onChanged: (user: PlatformUser) => void;
}) {
  const { message, modal } = App.useApp();
  const [setStatus, statusMut] = useSetPlatformUserStatusMutation();
  const [setAdmin, adminMut] = useSetPlatformUserAdminMutation();

  async function toggleStatus() {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      const updated = await setStatus({ userId: user.id, status: nextStatus }).unwrap();
      onChanged(updated);
      message.success(nextStatus === 'suspended' ? 'Account suspended' : 'Account reactivated');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this account'));
    }
  }

  async function toggleAdmin() {
    const nextAdmin = !user.isSuperAdmin;
    const confirmed = await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: nextAdmin ? 'Promote to Super Admin?' : 'Remove Super Admin?',
        content: nextAdmin
          ? `${user.firstName} ${user.lastName} will gain full access to every club and the org tree.`
          : `${user.firstName} ${user.lastName} will lose global access.`,
        okText: nextAdmin ? 'Promote' : 'Remove',
        cancelText: 'Cancel',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;
    try {
      const updated = await setAdmin({ userId: user.id, isSuperAdmin: nextAdmin }).unwrap();
      onChanged(updated);
      message.success(nextAdmin ? 'Promoted to Super Admin' : 'Removed Super Admin rights');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update Super Admin status'));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="small"
        danger={user.status === 'active'}
        disabled={isSelf && user.status === 'active'}
        title={
          isSelf && user.status === 'active' ? "You can't suspend your own account" : undefined
        }
        loading={statusMut.isLoading}
        onClick={() => void toggleStatus()}
      >
        {user.status === 'active' ? 'Suspend account' : 'Reactivate account'}
      </Button>
      <Button
        size="small"
        disabled={isSelf}
        title={isSelf ? "You can't change your own Super Admin status" : undefined}
        loading={adminMut.isLoading}
        onClick={() => void toggleAdmin()}
      >
        {user.isSuperAdmin ? 'Remove Super Admin' : 'Make Super Admin'}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------- password -- */

function PasswordSection({ userId, firstName }: { userId: string; firstName: string }) {
  const { message } = App.useApp();
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState(() => generatePassword());
  const [justSet, setJustSet] = useState<string | null>(null);
  const [resetPassword, { isLoading }] = useResetPlatformUserPasswordMutation();

  const passwordValid = password.trim().length >= 8;

  async function handleReset() {
    if (!passwordValid) return;
    try {
      await resetPassword({ userId, password: password.trim() }).unwrap();
      setJustSet(password.trim());
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not reset the password'));
    }
  }

  async function handleCopy() {
    if (!justSet) return;
    try {
      await navigator.clipboard.writeText(`Password: ${justSet}`);
      message.success('Copied');
    } catch {
      message.error('Could not copy — select the text manually');
    }
  }

  function handleDone() {
    setJustSet(null);
    setExpanded(false);
    setPassword(generatePassword());
  }

  if (justSet) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
          <CheckCircle size={16} weight="fill" />
          <p className="text-sm font-medium">Password reset</p>
        </div>
        <p className="text-xs text-ink-muted">
          Shown once — copy it now and share it with {firstName} directly. Every active session for
          this account was signed out.
        </p>
        <pre className="rounded-lg border border-line bg-fill px-3 py-2 text-xs text-ink">
          Password: {justSet}
        </pre>
        <div className="flex justify-end gap-2">
          <Button size="small" icon={<Copy size={13} />} onClick={() => void handleCopy()}>
            Copy
          </Button>
          <Button size="small" type="primary" onClick={handleDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <Button size="small" onClick={() => setExpanded(true)}>
        Reset password
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex items-center gap-2">
        <Input.Password
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          status={password.length > 0 && !passwordValid ? 'error' : undefined}
        />
        <Button
          icon={<ArrowsClockwise size={14} />}
          onClick={() => setPassword(generatePassword())}
          title="Generate a new password"
        />
      </div>
      <p className="text-xs text-ink-muted">
        At least 8 characters. Every active session for this account will be signed out.
      </p>
      <div className="flex justify-end gap-2">
        <Button size="small" onClick={() => setExpanded(false)}>
          Cancel
        </Button>
        <Button
          size="small"
          type="primary"
          disabled={!passwordValid}
          loading={isLoading}
          onClick={() => void handleReset()}
        >
          Set new password
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- memberships -- */

function MembershipsSection({ userId }: { userId: string }) {
  const { data, isLoading } = useGetPlatformUserMembershipsQuery(userId);
  const memberships = data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : memberships.length === 0 ? (
        <p className="text-sm text-ink-muted">Not a member of any club yet.</p>
      ) : (
        memberships.map((membership) => (
          <MembershipCard key={membership.id} userId={userId} membership={membership} />
        ))
      )}
      <AddMembershipForm userId={userId} />
    </div>
  );
}

function MembershipCard({
  userId,
  membership,
}: {
  userId: string;
  membership: PlatformUserMembership;
}) {
  const { message } = App.useApp();
  const [roles, setRoles] = useState<OfficerRole[]>(membership.roles);
  const [isClubAdmin, setIsClubAdmin] = useState(membership.isClubAdmin);
  const [updateMembership, { isLoading }] = useUpdatePlatformUserMembershipMutation();

  const removed = membership.status === 'removed';
  const dirty = !rolesEqual(roles, membership.roles) || isClubAdmin !== membership.isClubAdmin;

  async function handleSave() {
    try {
      await updateMembership({ userId, membershipId: membership.id, roles, isClubAdmin }).unwrap();
      message.success('Membership updated');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this membership'));
    }
  }

  async function handleRemove() {
    try {
      await updateMembership({ userId, membershipId: membership.id, status: 'removed' }).unwrap();
      message.success('Removed from club');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not remove this membership'));
    }
  }

  async function handleReactivate() {
    try {
      await updateMembership({ userId, membershipId: membership.id, status: 'active' }).unwrap();
      message.success('Reactivated');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not reactivate this membership'));
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{membership.clubName}</span>
        {removed ? <Tag color="default">Removed</Tag> : null}
      </div>
      <Select<OfficerRole[]>
        mode="multiple"
        className="w-full"
        value={roles}
        disabled={removed}
        onChange={setRoles}
        options={ROLE_OPTIONS}
      />
      <div className="flex items-center justify-between gap-2">
        <Checkbox
          checked={isClubAdmin}
          disabled={removed}
          onChange={(e) => setIsClubAdmin(e.target.checked)}
        >
          Club Admin
        </Checkbox>
        <div className="flex items-center gap-2">
          {dirty && !removed ? (
            <Button
              size="small"
              type="primary"
              loading={isLoading}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
          ) : null}
          {removed ? (
            <Button size="small" loading={isLoading} onClick={() => void handleReactivate()}>
              Reactivate
            </Button>
          ) : (
            <Popconfirm
              title="Remove from this club?"
              okText="Remove"
              okButtonProps={{ danger: true, loading: isLoading }}
              cancelText="Cancel"
              onConfirm={() => void handleRemove()}
            >
              <Button size="small" danger>
                Remove
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>
    </div>
  );
}

function AddMembershipForm({ userId }: { userId: string }) {
  const { message } = App.useApp();
  const { data: clubs, isLoading: clubsLoading } = useListOrgClubsQuery();
  const [clubId, setClubId] = useState<string | undefined>(undefined);
  const [roles, setRoles] = useState<OfficerRole[]>([]);
  const [isClubAdmin, setIsClubAdmin] = useState(false);
  const [memberType, setMemberType] = useState<MemberType | undefined>(undefined);
  const [addMembership, { isLoading }] = useAddPlatformUserMembershipMutation();

  const clubOptions = useMemo(
    () => (clubs ?? []).map((club) => ({ value: club.id, label: club.name })),
    [clubs],
  );

  async function handleAdd() {
    if (!clubId) return;
    try {
      await addMembership({ userId, clubId, roles, isClubAdmin, memberType }).unwrap();
      message.success('Added to club');
      setClubId(undefined);
      setRoles([]);
      setIsClubAdmin(false);
      setMemberType(undefined);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not add this club'));
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-line p-3">
      <Select
        placeholder="Select a club"
        className="w-full"
        allowClear
        showSearch
        optionFilterProp="label"
        loading={clubsLoading}
        value={clubId}
        onChange={setClubId}
        options={clubOptions}
      />
      <Select<OfficerRole[]>
        mode="multiple"
        className="w-full"
        placeholder="Defaults to plain Member"
        value={roles}
        onChange={setRoles}
        options={ROLE_OPTIONS}
      />
      <div className="flex items-center justify-between gap-2">
        <Checkbox checked={isClubAdmin} onChange={(e) => setIsClubAdmin(e.target.checked)}>
          Club Admin
        </Checkbox>
        <Select
          placeholder="Member type"
          className="!w-40"
          allowClear
          value={memberType}
          onChange={setMemberType}
          options={MEMBER_TYPE_OPTIONS}
        />
      </div>
      <Button
        type="dashed"
        icon={<Plus size={14} weight="bold" />}
        disabled={!clubId}
        loading={isLoading}
        onClick={() => void handleAdd()}
        block
      >
        Add to club
      </Button>
    </div>
  );
}

/* -------------------------------------------------- org assignments -- */

function OrgAssignmentsSection({ userId }: { userId: string }) {
  const { data, isLoading } = useGetPlatformUserOrgAssignmentsQuery(userId);
  const assignments = data ?? [];
  const [removeAssignment, { isLoading: isRemoving }] =
    useRemovePlatformUserOrgAssignmentMutation();
  const { message } = App.useApp();

  async function handleRemove(assignment: PlatformUserOrgAssignment) {
    try {
      await removeAssignment({ userId, assignmentId: assignment.id }).unwrap();
      message.success('Assignment removed');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not remove this assignment'));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-ink-muted">No Director roles assigned.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-line p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{assignment.role}</p>
                <p className="truncate text-xs text-ink-muted">{assignment.unitName}</p>
              </div>
              <Popconfirm
                title="Remove this Director assignment?"
                okText="Remove"
                okButtonProps={{ danger: true, loading: isRemoving }}
                cancelText="Cancel"
                onConfirm={() => void handleRemove(assignment)}
              >
                <Button size="small" danger icon={<Trash size={13} weight="bold" />} />
              </Popconfirm>
            </li>
          ))}
        </ul>
      )}
      <AssignOrgRoleForm userId={userId} />
    </div>
  );
}

function AssignOrgRoleForm({ userId }: { userId: string }) {
  const { message } = App.useApp();
  const [level, setLevel] = useState<DirectorLevel>('district');
  const [districtId, setDistrictId] = useState<string | undefined>(undefined);
  const [divisionId, setDivisionId] = useState<string | undefined>(undefined);
  const [areaId, setAreaId] = useState<string | undefined>(undefined);
  const [addAssignment, { isLoading }] = useAddPlatformUserOrgAssignmentMutation();

  const { data: districts, isLoading: districtsLoading } = useListDistrictsQuery();
  const { data: divisions, isLoading: divisionsLoading } = useListDivisionsQuery();
  const { data: areas, isLoading: areasLoading } = useListAreasQuery();

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

  function handleLevelChange(next: DirectorLevel) {
    setLevel(next);
    if (next === 'district') {
      setDivisionId(undefined);
      setAreaId(undefined);
    } else if (next === 'division') {
      setAreaId(undefined);
    }
  }

  const unitId = level === 'district' ? districtId : level === 'division' ? divisionId : areaId;
  const canAssign = unitId !== undefined;

  async function handleAssign() {
    if (!unitId) return;
    const levelInfo = DIRECTOR_LEVELS.find((l) => l.value === level);
    if (!levelInfo) return;
    try {
      await addAssignment({
        userId,
        role: levelInfo.role,
        unitType: level,
        unitId,
      }).unwrap();
      message.success('Director role assigned');
      setDistrictId(undefined);
      setDivisionId(undefined);
      setAreaId(undefined);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not assign this Director role'));
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-line p-3">
      <Segmented
        value={level}
        onChange={(value) => handleLevelChange(value as DirectorLevel)}
        options={DIRECTOR_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
        block
      />
      <Select
        placeholder="Select a district"
        className="w-full"
        allowClear
        showSearch
        optionFilterProp="label"
        loading={districtsLoading}
        value={districtId}
        onChange={setDistrictId}
        options={districtOptions}
      />
      {level !== 'district' ? (
        <Select
          placeholder="Select a division"
          className="w-full"
          allowClear
          showSearch
          optionFilterProp="label"
          loading={divisionsLoading}
          value={divisionId}
          onChange={setDivisionId}
          options={divisionOptions}
        />
      ) : null}
      {level === 'area' ? (
        <Select
          placeholder="Select an area"
          className="w-full"
          allowClear
          showSearch
          optionFilterProp="label"
          loading={areasLoading}
          value={areaId}
          onChange={setAreaId}
          options={areaOptions}
        />
      ) : null}
      <Button
        type="dashed"
        icon={<Plus size={14} weight="bold" />}
        disabled={!canAssign}
        loading={isLoading}
        onClick={() => void handleAssign()}
        block
      >
        Assign
      </Button>
    </div>
  );
}
