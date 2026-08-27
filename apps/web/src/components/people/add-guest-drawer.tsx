'use client';

import { App, Button, Drawer, Form, Input, Radio, Select, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ReadOnly } from '@/components/permissions/read-only';
import { getGuestFullName } from '@/lib/people/guests';
import { emailRules, normalizePhone, phoneRules, shortNameRules } from '@/lib/validation/rules';
import { useCreateGuestMutation, useSearchMembersForGuestAddQuery } from '@/store/api';
import { getApiErrorMessage, getFieldErrors } from '@/store/api-error';

interface AddGuestDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  membershipId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  invitedBy?: string;
}

type AddMode = 'new' | 'existing';

interface AvailableMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  clubName: string;
}

/** Quick-add — just enough to get a guest into the pipeline. Avatar, socials,
 * bio, and notes are deliberately left off; `GuestEditPanel` covers those one
 * click later, on the profile the guest lands on after this saves.
 *
 * Supports two modes: adding a new guest manually, or adding an existing
 * Toastmaster member as a guest to another club. */
export function AddGuestDrawer({ open, onClose }: AddGuestDrawerProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();
  const [mode, setMode] = useState<AddMode>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<AvailableMember | null>(null);
  const [createGuest, { isLoading }] = useCreateGuestMutation();
  const { data: availableMembers = [], isLoading: isSearching } = useSearchMembersForGuestAddQuery(
    { q: searchQuery },
    { skip: mode !== 'existing' || !open },
  );

  function handleClose() {
    form.resetFields();
    setMode('new');
    setSearchQuery('');
    setSelectedMember(null);
    onClose();
  }

  function handleMemberSelect(memberId: string) {
    const member = availableMembers.find((m) => m.id === memberId);
    if (member) {
      setSelectedMember(member);
      form.setFieldsValue({
        membershipId: memberId,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email || undefined,
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
      let input: typeof values;
      if (mode === 'existing') {
        input = {
          membershipId: values.membershipId!,
          email: values.email || undefined,
          phone: values.phone ? normalizePhone(values.phone) : undefined,
          whatsapp: values.whatsapp ? normalizePhone(values.whatsapp) : undefined,
        };
      } else {
        input = {
          firstName: values.firstName!.trim(),
          lastName: values.lastName?.trim(),
          email: values.email?.trim(),
          phone: values.phone ? normalizePhone(values.phone) : undefined,
          whatsapp: values.whatsapp ? normalizePhone(values.whatsapp) : undefined,
          invitedBy: values.invitedBy?.trim(),
        };
      }

      const guest = await createGuest(input as Parameters<typeof createGuest>[0]).unwrap();
      message.success(`${getGuestFullName(guest)} added to the guest list`);
      handleClose();
      router.push(`/people/${guest.id}`);
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

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      placement="right"
      size="min(480px, 100vw)"
      title={
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-ink">Add guest</div>
          <div className="text-xs font-normal text-ink-muted">
            Photo, bio, and socials can be added from their profile afterward.
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <ReadOnly resource="guest" action="create">
            <Button type="primary" loading={isLoading} onClick={handleSave}>
              Add guest
            </Button>
          </ReadOnly>
        </div>
      }
      styles={{
        body: { paddingTop: 20, paddingBottom: 20 },
        footer: { padding: '12px 24px' },
      }}
    >
      <ReadOnly resource="guest" action="create" display="block">
        <Form form={form} layout="vertical" requiredMark="optional" disabled={isLoading}>
          <Form.Item className="!mb-6">
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
              <Radio value="new">Add new guest</Radio>
              <Radio value="existing">Add existing member</Radio>
            </Radio.Group>
          </Form.Item>

          {mode === 'new' ? (
            <>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <Form.Item label="First name" name="firstName" rules={shortNameRules('First name')}>
                  <Input placeholder="First name" autoFocus />
                </Form.Item>
                <Form.Item
                  label="Last name"
                  name="lastName"
                  rules={shortNameRules('Last name', { required: false })}
                >
                  <Input placeholder="Last name" />
                </Form.Item>
              </div>

              <Form.Item label="Email" name="email" rules={emailRules()}>
                <Input placeholder="name@example.com" type="email" />
              </Form.Item>

              <Form.Item label="Phone" name="phone" rules={phoneRules({ required: false })}>
                <Input placeholder="01568286512" type="tel" inputMode="tel" />
              </Form.Item>

              <Form.Item
                label="WhatsApp number"
                name="whatsapp"
                rules={phoneRules({ required: false })}
              >
                <Input placeholder="Leave blank if same as phone" type="tel" inputMode="tel" />
              </Form.Item>

              <Form.Item label="Invited by" name="invitedBy" className="!mb-0">
                <Input placeholder="Who brought them along?" maxLength={120} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                label="Select member"
                name="membershipId"
                rules={[{ required: true, message: 'Please select a member' }]}
              >
                <Spin spinning={isSearching}>
                  <Select
                    allowClear
                    showSearch
                    placeholder="Search by name or email..."
                    filterOption={false}
                    onSearch={setSearchQuery}
                    onChange={handleMemberSelect}
                    options={availableMembers.map((member) => ({
                      label: `${member.firstName} ${member.lastName} (${member.clubName})`,
                      value: member.id,
                    }))}
                  />
                </Spin>
              </Form.Item>

              {selectedMember && (
                <div className="mb-4 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                  <div className="text-sm">
                    <div className="font-medium text-ink">
                      {selectedMember.firstName} {selectedMember.lastName}
                    </div>
                    <div className="text-xs text-ink-muted">{selectedMember.clubName}</div>
                    {selectedMember.email && (
                      <div className="text-xs text-ink-muted">{selectedMember.email}</div>
                    )}
                  </div>
                </div>
              )}

              <Form.Item label="Email" name="email" rules={emailRules()}>
                <Input placeholder="name@example.com" type="email" disabled />
              </Form.Item>

              <Form.Item label="Phone" name="phone" rules={phoneRules({ required: false })}>
                <Input placeholder="01568286512" type="tel" inputMode="tel" />
              </Form.Item>

              <Form.Item
                label="WhatsApp number"
                name="whatsapp"
                rules={phoneRules({ required: false })}
                className="!mb-0"
              >
                <Input placeholder="Leave blank if same as phone" type="tel" inputMode="tel" />
              </Form.Item>
            </>
          )}
        </Form>
      </ReadOnly>
    </Drawer>
  );
}
