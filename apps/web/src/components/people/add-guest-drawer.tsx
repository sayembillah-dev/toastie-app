'use client';

import { App, Button, Drawer, Form, Input } from 'antd';
import { useRouter } from 'next/navigation';

import { emailRules, normalizePhone, phoneRules, shortNameRules } from '@/lib/validation/rules';
import { useCreateGuestMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface AddGuestDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  invitedBy?: string;
}

/** Quick-add — just enough to get a guest into the pipeline. Avatar, socials,
 * bio, and notes are deliberately left off; `GuestEditPanel` covers those one
 * click later, on the profile the guest lands on after this saves. */
export function AddGuestDrawer({ open, onClose }: AddGuestDrawerProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();
  const [createGuest, { isLoading }] = useCreateGuestMutation();

  function handleClose() {
    form.resetFields();
    onClose();
  }

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    try {
      const guest = await createGuest({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email?.trim() || undefined,
        phone: values.phone ? normalizePhone(values.phone) : undefined,
        whatsapp: values.whatsapp ? normalizePhone(values.whatsapp) : undefined,
        invitedBy: values.invitedBy?.trim() || undefined,
      }).unwrap();
      message.success(`${guest.firstName} ${guest.lastName} added to the guest list`);
      form.resetFields();
      onClose();
      router.push(`/people/${guest.id}`);
    } catch (err) {
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
          <Button type="primary" loading={isLoading} onClick={handleSave}>
            Add guest
          </Button>
        </div>
      }
      styles={{
        body: { paddingTop: 20, paddingBottom: 20 },
        footer: { padding: '12px 24px' },
      }}
    >
      <Form form={form} layout="vertical" requiredMark="optional" disabled={isLoading}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="First name" name="firstName" rules={shortNameRules('First name')}>
            <Input placeholder="First name" autoFocus />
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

        <Form.Item label="WhatsApp number" name="whatsapp" rules={phoneRules({ required: false })}>
          <Input placeholder="Leave blank if same as phone" type="tel" inputMode="tel" />
        </Form.Item>

        <Form.Item label="Invited by" name="invitedBy" className="!mb-0">
          <Input placeholder="Who brought them along?" maxLength={120} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
