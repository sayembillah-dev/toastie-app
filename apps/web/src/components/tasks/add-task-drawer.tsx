'use client';

import { App, Button, Drawer, Form, Input, Segmented, Select } from 'antd';
import { useMemo } from 'react';

import { officerOptions } from '@/lib/tasks/task-ui';
import { TASK_DESCRIPTION_MAX, TASK_TITLE_MAX, type TaskPriority } from '@/lib/tasks/tasks';
import { useCreateTaskMutation, useGetMembersQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const { TextArea } = Input;

interface AddTaskDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  title: string;
  description?: string;
  priority: TaskPriority;
  assigneeMembershipIds: string[];
}

const DEFAULT_VALUES: FormValues = {
  title: '',
  priority: 'Medium',
  assigneeMembershipIds: [],
};

/** Officer-only create form — gated by the "Add task" button only rendering
 * for someone `can('create', 'task')`, mirrored server-side by the `task`
 * grant on every non-Member club role. */
export function AddTaskDrawer({ open, onClose }: AddTaskDrawerProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const { data: members } = useGetMembersQuery();
  const [createTask, { isLoading }] = useCreateTaskMutation();
  const officers = useMemo(() => officerOptions(members ?? []), [members]);

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
      await createTask({
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        priority: values.priority,
        assigneeMembershipIds: values.assigneeMembershipIds,
      }).unwrap();
      message.success('Task created');
      form.resetFields();
      onClose();
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
      title="New task"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="primary" loading={isLoading} onClick={handleSave}>
            Create task
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
        requiredMark="optional"
        disabled={isLoading}
        initialValues={DEFAULT_VALUES}
      >
        <Form.Item
          label="Title"
          name="title"
          rules={[
            { required: true, whitespace: true, message: 'Give the task a title' },
            { max: TASK_TITLE_MAX, message: `Keep it under ${TASK_TITLE_MAX} characters` },
          ]}
        >
          <Input placeholder="What needs to happen?" autoFocus maxLength={TASK_TITLE_MAX} />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
          rules={[{ max: TASK_DESCRIPTION_MAX, message: 'That description is too long' }]}
        >
          <TextArea rows={3} placeholder="Any detail the assignee needs (optional)" />
        </Form.Item>

        <Form.Item label="Priority" name="priority">
          <Segmented
            options={[
              { label: 'Low', value: 'Low' },
              { label: 'Medium', value: 'Medium' },
              { label: 'High', value: 'High' },
            ]}
            block
          />
        </Form.Item>

        <Form.Item label="Assigned to" name="assigneeMembershipIds" className="!mb-0">
          <Select
            mode="multiple"
            options={officers}
            showSearch
            allowClear
            optionFilterProp="label"
            placeholder="Search officers…"
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
