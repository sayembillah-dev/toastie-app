'use client';

import { App, Button, Modal, Select } from 'antd';
import { useState } from 'react';

interface MoveModalProps {
  open: boolean;
  /** e.g. "Move Sunrise Toastmasters" */
  title: string;
  /** e.g. "New area" */
  fieldLabel: string;
  currentParentId: string;
  options: { value: string; label: string }[];
  onMove: (targetId: string) => Promise<void>;
  onClose: () => void;
}

/** Reparents any org-tree entity — the same "move" action district, division
 * and area dashboards all offer for their children, just with a different
 * options list depending on how wide the acting dashboard's scope is. */
export function MoveModal({
  open,
  title,
  fieldLabel,
  currentParentId,
  options,
  onMove,
  onClose,
}: MoveModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title={title} footer={null} destroyOnHidden>
      <MoveModalBody
        key={currentParentId}
        fieldLabel={fieldLabel}
        currentParentId={currentParentId}
        options={options}
        onMove={onMove}
        onClose={onClose}
      />
    </Modal>
  );
}

interface MoveModalBodyProps {
  fieldLabel: string;
  currentParentId: string;
  options: { value: string; label: string }[];
  onMove: (targetId: string) => Promise<void>;
  onClose: () => void;
}

function MoveModalBody({
  fieldLabel,
  currentParentId,
  options,
  onMove,
  onClose,
}: MoveModalBodyProps) {
  const { message } = App.useApp();
  const otherOptions = options.filter((option) => option.value !== currentParentId);
  const [targetId, setTargetId] = useState<string | undefined>(otherOptions[0]?.value);
  const [isSaving, setIsSaving] = useState(false);

  const handleMove = async () => {
    if (!targetId) return;
    setIsSaving(true);
    try {
      await onMove(targetId);
      message.success('Moved');
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not move this item');
    } finally {
      setIsSaving(false);
    }
  };

  if (otherOptions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">There is nowhere else to move this to yet.</p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="move-target" className="text-sm font-medium text-ink">
          {fieldLabel}
        </label>
        <Select
          id="move-target"
          className="w-full"
          value={targetId}
          onChange={setTargetId}
          options={otherOptions}
          showSearch
          optionFilterProp="label"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="primary" disabled={!targetId} loading={isSaving} onClick={handleMove}>
          Move
        </Button>
      </div>
    </div>
  );
}
