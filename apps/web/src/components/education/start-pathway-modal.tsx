'use client';

import {
  CheckCircle,
  Compass,
  GraduationCap,
  Path,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Modal, Select } from 'antd';
import { useMemo, useState } from 'react';

import type { Level, Member, Pathway } from '@/lib/education/members';
import { PATHWAYS } from '@/lib/education/members';
import { getProjectsForPathway } from '@/lib/education/pathways';
import { useStartPathwayMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface StartPathwayModalProps {
  open: boolean;
  member: Member;
  onClose: () => void;
}

interface FormState {
  pathway: Pathway | null;
  project: string | null;
}

/** Blank for a first start; prefilled with the member's current picks when
 * the modal doubles as the "update my pathway" editor. */
function initialFormFor(member: Member): FormState {
  return { pathway: member.pathway ?? null, project: member.startedProject ?? null };
}

function LevelPill({ level }: { level: Level | null }) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
        level ? 'border-line-strong bg-fill' : 'border-dashed border-line-strong bg-sidebar'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            level ? 'bg-ink text-white' : 'bg-fill-strong text-ink-muted'
          }`}
        >
          <GraduationCap size={18} weight="bold" />
        </span>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Starting level
          </div>
          <div className={`mt-0.5 text-sm font-semibold ${level ? 'text-ink' : 'text-ink-muted'}`}>
            {level ? `Level ${level}` : 'Pick a project to set the level'}
          </div>
        </div>
      </div>
      {level ? (
        <span
          className="hidden items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-soft sm:inline-flex"
          aria-hidden
        >
          <CheckCircle size={12} weight="bold" />
          Auto-selected
        </span>
      ) : null}
    </div>
  );
}

export function StartPathwayModal({ open, member, onClose }: StartPathwayModalProps) {
  const [form, setForm] = useState<FormState>(() => initialFormFor(member));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startPathway, { isLoading: isSubmitting }] = useStartPathwayMutation();
  const { message } = App.useApp();

  /* Cleared from antd's `afterClose` rather than an effect on `open`, so the
   * reset runs once the dialog has actually gone instead of triggering a
   * cascading render on every close. */
  function resetForm() {
    setForm(initialFormFor(member));
    setSubmitError(null);
  }

  const projects = useMemo(
    () => (form.pathway ? getProjectsForPathway(form.pathway) : []),
    [form.pathway],
  );
  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.name,
        label: `${project.name} · Level ${project.level}`,
      })),
    [projects],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.name === form.project) ?? null,
    [projects, form.project],
  );

  const canSubmit = form.pathway !== null && selectedProject !== null;
  /** The same dialog doubles as the self-service "change my
   * pathway/level/project" editor — copy shifts once a pathway exists. */
  const isUpdate = Boolean(member.pathway && member.level);

  /* `unwrap()` turns a rejected mutation into a throw so the modal can stay open
   * and surface the reason instead of silently closing on a failed write. */
  async function handleSubmit() {
    if (!form.pathway || !selectedProject) return;
    setSubmitError(null);

    try {
      await startPathway({
        memberId: member.id,
        pathway: form.pathway,
        project: selectedProject.name,
        level: selectedProject.level,
      }).unwrap();

      message.success(
        isUpdate
          ? `${member.firstName}'s pathway was updated`
          : `${member.firstName} started ${form.pathway}`,
      );
      onClose();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Could not start the pathway'));
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterClose={resetForm}
      onOk={() => {
        void handleSubmit();
      }}
      confirmLoading={isSubmitting}
      mask={{ closable: !isSubmitting }}
      okText={isUpdate ? 'Save Changes' : 'Start Pathway'}
      cancelText="Cancel"
      okButtonProps={{ disabled: !canSubmit, size: 'middle' }}
      cancelButtonProps={{ size: 'middle', disabled: isSubmitting }}
      title={null}
      closable={!isSubmitting}
      centered
      width="min(520px, calc(100vw - 32px))"
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex flex-col gap-5">
        <header className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-1">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white"
          >
            <Path size={20} weight="bold" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">
              {isUpdate ? 'Update Pathway' : 'Start a Pathway'}
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {isUpdate
                ? `Change ${member.firstName}'s pathway, level, or current project. Past history stays put — progress continues from the project you select.`
                : `Set ${member.firstName}'s learning path. Their history and progress on Toastie begin from the level of the project you select.`}
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-4 px-6 pb-2">
          <div>
            <label
              htmlFor="pathway-select"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink"
            >
              <Path size={12} weight="bold" className="text-ink-muted" />
              Pathway
              <span className="text-ink-muted font-normal">· Required</span>
            </label>
            <Select
              id="pathway-select"
              size="large"
              className="w-full"
              placeholder="Select a Toastmasters pathway"
              value={form.pathway ?? undefined}
              onChange={(value: Pathway) => setForm({ pathway: value, project: null })}
              options={PATHWAYS.map((pathway) => ({ value: pathway, label: pathway }))}
              showSearch
              optionFilterProp="label"
            />
          </div>

          <div>
            <label
              htmlFor="project-select"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink"
            >
              <Compass size={12} weight="bold" className="text-ink-muted" />
              Current project
              <span className="text-ink-muted font-normal">· Required</span>
            </label>
            <Select
              id="project-select"
              size="large"
              className="w-full"
              placeholder={
                form.pathway ? 'Which project are they on now?' : 'Choose a pathway first'
              }
              value={form.project ?? undefined}
              onChange={(value: string) => setForm((prev) => ({ ...prev, project: value }))}
              options={projectOptions}
              disabled={!form.pathway}
              showSearch
              optionFilterProp="label"
            />
            <p className="mt-1.5 text-[11px] text-ink-muted">
              Members migrating in mid-pathway can pick their real starting project — the level
              below adjusts automatically.
            </p>
          </div>

          <LevelPill level={selectedProject?.level ?? null} />

          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-line-strong bg-fill px-3 py-2.5 text-xs text-ink-soft"
            >
              <WarningCircle size={14} weight="bold" className="mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
