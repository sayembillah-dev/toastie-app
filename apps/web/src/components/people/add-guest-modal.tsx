'use client';

import {
  ArrowLeft,
  ArrowsClockwise,
  CaretRight,
  Copy,
  Link as LinkIcon,
  PaperPlaneTilt,
  PencilSimpleLine,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Avatar, Button, Form, Input, Modal, Popconfirm, QRCode, Spin, Tag } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ReadOnly } from '@/components/permissions/read-only';
import { getGuestFullName } from '@/lib/people/guests';
import { useIsMobile } from '@/lib/ui/use-is-mobile';
import {
  emailRules,
  fullNameRules,
  normalizePhone,
  PHONE_REGEX,
  phoneRules,
} from '@/lib/validation/rules';
import {
  useCreateGuestMutation,
  useGetGuestInviteLinkQuery,
  useLookupPersonByPhoneQuery,
  useRotateGuestInviteLinkMutation,
} from '@/store/api';
import { getApiErrorMessage, getFieldErrors } from '@/store/api-error';

/** The wizard's screens. `choose` is the landing step; the manual path runs
 * `phone` → `found` / `details`; `invite` is the share-a-link path. */
type Step = 'choose' | 'phone' | 'found' | 'details' | 'invite';

const STEP_META: Record<Step, { title: string; sub?: string; backTo?: Step }> = {
  choose: { title: 'Add guest' },
  phone: { title: 'Add manually', sub: "What's the person's number?", backTo: 'choose' },
  found: { title: 'Add manually', sub: 'This number is already on file', backTo: 'phone' },
  details: { title: 'Add manually', sub: 'Nothing on file for this number', backTo: 'phone' },
  invite: { title: 'Send invitation link', sub: 'They add themselves', backTo: 'choose' },
};

interface AddGuestModalProps {
  open: boolean;
  onClose: () => void;
}

/** The single "Add guest" flow on People → Guests — one modal replacing the
 * old drawer + invite dialog pair:
 *
 * - **Add manually** — number-first (IDENTITY_PLAN §7): ask for the phone
 *   number, check the global pool, then either confirm the person we found or
 *   collect a fresh guest's details. This also covers the retired "add
 *   existing member" mode: a member of another club resolves through the same
 *   phone lookup, and the create call links them via `personId` server-side.
 * - **Send invitation link** — the club's standing self-signup link, shown as
 *   a copyable URL + QR.
 *
 * Full-screen sheet on phones, a 440px dialog on desktop. */
export function AddGuestModal({ open, onClose }: AddGuestModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const isMobile = useIsMobile();
  const fullScreen = isMobile === true;

  function handleClose() {
    setStep('choose');
    onClose();
  }

  const meta = STEP_META[step];

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={fullScreen ? '100%' : 440}
      style={
        fullScreen
          ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0, height: '100dvh' }
          : undefined
      }
      styles={
        fullScreen
          ? {
              container: {
                height: '100dvh',
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
              },
              body: { flex: 1, overflowY: 'auto' },
            }
          : undefined
      }
      title={
        <div className="flex items-center gap-1.5">
          {meta.backTo ? (
            <Button
              type="text"
              size="small"
              aria-label="Back"
              icon={<ArrowLeft size={16} />}
              onClick={() => setStep(meta.backTo!)}
              className="-ml-2"
            />
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-ink">{meta.title}</div>
            {meta.sub ? <div className="text-xs font-normal text-ink-muted">{meta.sub}</div> : null}
          </div>
        </div>
      }
    >
      <ModalBody step={step} onStepChange={setStep} onClose={handleClose} />
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Body — holds the phone/lookup/form state so stepping Back loses nothing.   */
/* -------------------------------------------------------------------------- */

interface ModalBodyProps {
  step: Step;
  onStepChange: (step: Step) => void;
  onClose: () => void;
}

interface DetailsFormValues {
  name: string;
  email?: string;
  whatsapp?: string;
  invitedBy?: string;
}

function ModalBody({ step, onStepChange, onClose }: ModalBodyProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<DetailsFormValues>();
  const [createGuest, { isLoading: isSaving }] = useCreateGuestMutation();

  /* Number-first lookup: as the officer types, debounce to a settled value
   * and only fire once the input normalizes to a full 11-digit number. */
  const [phoneInput, setPhoneInput] = useState('');
  const normalizedPhone = normalizePhone(phoneInput);
  const isPhoneValid = PHONE_REGEX.test(normalizedPhone);

  const [debouncedPhone, setDebouncedPhone] = useState('');
  useEffect(() => {
    const next = isPhoneValid ? normalizedPhone : '';
    const timer = setTimeout(() => setDebouncedPhone(next), 400);
    return () => clearTimeout(timer);
  }, [normalizedPhone, isPhoneValid]);

  const {
    data: lookup,
    isFetching: isChecking,
    isError: isLookupError,
    error: lookupError,
    refetch: refetchLookup,
  } = useLookupPersonByPhoneQuery(debouncedPhone, { skip: !debouncedPhone });

  /** True while the typed number is ahead of the lookup — debounce window or
   * request in flight. */
  const isLookupPending = isPhoneValid && (debouncedPhone !== normalizedPhone || isChecking);
  /** The result only counts when it still matches what's in the box. */
  const lookupReady = Boolean(lookup) && debouncedPhone === normalizedPhone;
  const found = lookupReady && lookup?.status === 'found' ? lookup : null;

  /* Auto-advance once a fresh lookup resolves. `advancedForRef` pins the
   * number that already caused an advance so pressing Back doesn't bounce
   * straight forward again; editing the number clears the pin. A ref, not
   * state — the pin never needs to render anything. */
  const advancedForRef = useRef('');
  useEffect(() => {
    if (step !== 'phone' || !lookupReady || !lookup || debouncedPhone === advancedForRef.current) {
      return;
    }
    advancedForRef.current = debouncedPhone;
    onStepChange(lookup.status === 'found' ? 'found' : 'details');
  }, [step, lookup, lookupReady, debouncedPhone, onStepChange]);

  function handlePhoneChange(value: string) {
    setPhoneInput(value);
    advancedForRef.current = '';
  }

  /** The explicit path past the phone step — for when the lookup errors out
   * (the officer can still continue) or is already resolved and pinned. */
  function handleContinue() {
    if (!isPhoneValid || isLookupPending) return;
    advancedForRef.current = debouncedPhone;
    if (lookup) {
      onStepChange(lookup.status === 'found' ? 'found' : 'details');
    } else if (isLookupError) {
      onStepChange('details');
    }
  }

  async function afterCreate(guestId: string, fullName: string) {
    message.success(`${fullName} added to the guest list`);
    onClose();
    router.push(`/people/${guestId}`);
  }

  /** Found-person add: send the shared profile back so the guest row is born
   * with the same details; the API links `personId` from the number. */
  async function handleAddFound() {
    if (!found) return;
    try {
      const guest = await createGuest({
        name: [found.firstName, found.lastName].filter(Boolean).join(' ') || debouncedPhone,
        phone: debouncedPhone,
        email: found.email,
        whatsapp: found.whatsapp,
      }).unwrap();
      await afterCreate(guest.id, getGuestFullName(guest));
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  }

  async function handleAddNew() {
    let values: DetailsFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      const guest = await createGuest({
        name: values.name.trim(),
        email: values.email?.trim() || undefined,
        phone: normalizedPhone,
        whatsapp: values.whatsapp ? normalizePhone(values.whatsapp) : undefined,
        invitedBy: values.invitedBy?.trim() || undefined,
      }).unwrap();
      await afterCreate(guest.id, getGuestFullName(guest));
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        form.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: name as keyof DetailsFormValues,
            errors,
          })),
        );
        return;
      }
      message.error(getApiErrorMessage(err));
    }
  }

  if (step === 'choose') {
    return (
      <div className="flex flex-col gap-3">
        <OptionCard
          icon={<PencilSimpleLine size={20} weight="bold" />}
          title="Add manually"
          description="Type in their number — if we've met them before, their details fill in for you."
          onClick={() => onStepChange('phone')}
        />
        <OptionCard
          icon={<PaperPlaneTilt size={20} weight="bold" />}
          title="Send invitation link"
          description="Share a link or QR code — guests fill in their own details."
          onClick={() => onStepChange('invite')}
        />
      </div>
    );
  }

  if (step === 'phone') {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="add-guest-phone" className="mb-1.5 block text-sm font-medium text-ink">
            Mobile number
          </label>
          <Input
            id="add-guest-phone"
            size="large"
            type="tel"
            inputMode="tel"
            autoFocus
            placeholder="01568286512"
            aria-label="Mobile number"
            value={phoneInput}
            onChange={(event) => handlePhoneChange(event.target.value)}
            onPressEnter={handleContinue}
          />
          <div className="mt-1.5 min-h-4 text-xs text-ink-muted">
            {isLookupPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Spin size="small" /> Checking this number…
              </span>
            ) : isLookupError ? (
              <span>
                {getApiErrorMessage(lookupError, "Couldn't check this number.")}{' '}
                <button
                  type="button"
                  className="font-medium text-ink underline"
                  onClick={() => refetchLookup()}
                >
                  Try again
                </button>{' '}
                or continue anyway.
              </span>
            ) : phoneInput.trim() !== '' && !isPhoneValid ? (
              'Enter all 11 digits — we take it from there.'
            ) : (
              'We check the number against everyone already known across clubs, so shared details fill themselves in.'
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <ReadOnly resource="guest" action="create">
            <Button
              type="primary"
              className="w-full sm:w-auto"
              disabled={!isPhoneValid}
              loading={isLookupPending}
              onClick={handleContinue}
            >
              Continue
            </Button>
          </ReadOnly>
        </div>
      </div>
    );
  }

  if (step === 'found') {
    if (!found) {
      /* The cached lookup expired out from under the step (rare) — send the
       * officer back to re-check rather than stranding them. */
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">That number needs a fresh check.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => onStepChange('phone')} className="w-full sm:w-auto">
              Back to the number
            </Button>
          </div>
        </div>
      );
    }
    const alreadyHere = found.yourClub.isGuest || found.yourClub.isMember;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-line p-3.5">
          <Avatar size={44} src={found.avatarUrl}>
            {(found.firstName?.[0] ?? '') + (found.lastName?.[0] ?? '')}
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">
                {[found.firstName, found.lastName].filter(Boolean).join(' ')}
              </span>
              {found.claimed ? (
                <Tag color="green" className="m-0">
                  Has an account
                </Tag>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">{debouncedPhone}</div>
            {found.email ? (
              <div className="truncate text-xs text-ink-muted">{found.email}</div>
            ) : null}
            {found.organization ? (
              <div className="text-xs text-ink-muted">{found.organization}</div>
            ) : null}
            {found.memberOf.length > 0 ? (
              <div className="mt-1 text-xs text-ink-soft">
                Member of {found.memberOf.map((m) => m.clubName).join(', ')}
              </div>
            ) : null}
            {found.yourClub.visitCount > 0 ||
            found.yourClub.roleCount > 0 ||
            found.yourClub.speechCount > 0 ? (
              <div className="mt-0.5 text-xs text-ink-soft">
                With your club: {found.yourClub.visitCount} visits · {found.yourClub.roleCount}{' '}
                roles · {found.yourClub.speechCount} speeches
              </div>
            ) : null}
          </div>
        </div>

        {found.yourClub.isGuest ? (
          <p className="rounded-lg bg-fill px-3 py-2.5 text-xs text-ink-soft">
            Already in your guest list.{' '}
            <Link
              href={`/people/${found.yourClub.guestId}`}
              onClick={onClose}
              className="font-medium text-ink underline"
            >
              Open profile
            </Link>
          </p>
        ) : found.yourClub.isMember ? (
          <p className="rounded-lg bg-fill px-3 py-2.5 text-xs text-ink-soft">
            Already a member of this club — no need to add them as a guest.
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} className="w-full sm:w-auto" disabled={isSaving}>
            Cancel
          </Button>
          {!alreadyHere ? (
            <ReadOnly resource="guest" action="create">
              <Button
                type="primary"
                className="w-full sm:w-auto"
                loading={isSaving}
                onClick={handleAddFound}
              >
                Add guest
              </Button>
            </ReadOnly>
          ) : null}
        </div>
      </div>
    );
  }

  if (step === 'details') {
    /* The banner reflects how we got here: a resolved "not-found", or the
     * officer pressing on past a failed lookup. */
    const lookupFailed = !lookup && isLookupError && debouncedPhone === normalizedPhone;
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-fill px-3 py-2.5 text-xs text-ink-soft">
          {lookupFailed ? (
            <>
              We couldn&rsquo;t check{' '}
              <span className="font-medium text-ink">{normalizedPhone}</span> — no problem, fill in
              their details and they&rsquo;re on the list.
            </>
          ) : (
            <>
              No one is on file for <span className="font-medium text-ink">{normalizedPhone}</span>{' '}
              — fill in their details and they&rsquo;re on the list.
            </>
          )}
        </p>
        <Form form={form} layout="vertical" requiredMark="optional" disabled={isSaving}>
          <Form.Item label="Full name" name="name" rules={fullNameRules()}>
            <Input placeholder="e.g. Sayem Billah" autoComplete="name" autoFocus />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={emailRules()}>
            <Input placeholder="name@example.com" type="email" />
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
        </Form>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} className="w-full sm:w-auto" disabled={isSaving}>
            Cancel
          </Button>
          <ReadOnly resource="guest" action="create">
            <Button
              type="primary"
              className="w-full sm:w-auto"
              loading={isSaving}
              onClick={handleAddNew}
            >
              Add guest
            </Button>
          </ReadOnly>
        </div>
      </div>
    );
  }

  return <InviteStep />;
}

/* -------------------------------------------------------------------------- */
/* Choose step.                                                               */
/* -------------------------------------------------------------------------- */

interface OptionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

/** A full-width tap target for the landing step — big enough for thumbs,
 * with a chevron hinting the step moves forward. */
function OptionCard({ icon, title, description, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3.5 text-left transition-colors hover:border-line-strong hover:bg-sidebar"
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-ink"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
      </span>
      <CaretRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Invite step — the club's standing self-signup link as QR + copyable URL.   */
/* -------------------------------------------------------------------------- */

function InviteStep() {
  const { message } = App.useApp();
  const { data, isLoading, isError, error, refetch } = useGetGuestInviteLinkQuery();
  const [rotate, { isLoading: isRotating }] = useRotateGuestInviteLinkMutation();

  const origin = useMemo(
    () => (typeof window !== 'undefined' && window.location ? window.location.origin : ''),
    [],
  );
  const inviteUrl = data ? `${origin}/guest-invite/${data.token}` : '';

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      message.success('Link copied');
    } catch {
      message.error('Could not copy — select the text manually');
    }
  }

  async function handleRotate() {
    try {
      await rotate().unwrap();
      message.success('Link regenerated — the old one no longer works');
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't regenerate the link. Please try again."));
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spin />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <WarningCircle size={22} className="text-ink-muted" aria-hidden />
        <p className="text-sm text-ink-soft">
          {getApiErrorMessage(error, "Couldn't load the invite link.")}
        </p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted">
        Anyone with this link or QR can add themselves to the guest list with just their name and
        number — print it for the venue or drop it in a WhatsApp group. It keeps working until you
        regenerate it.
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center justify-center rounded-md bg-canvas p-1.5">
          <QRCode value={inviteUrl} size={104} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-xs font-medium text-ink">Guest sign-up link</p>
          <p className="truncate text-xs text-ink-muted" title={inviteUrl}>
            {inviteUrl}
          </p>
          <div>
            <Button size="small" icon={<LinkIcon size={13} />} onClick={handleCopyLink}>
              Copy link
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Popconfirm
          title="Regenerate the link?"
          description="Every copy of the current link and QR stops working immediately."
          okText="Regenerate"
          okButtonProps={{ danger: true }}
          onConfirm={handleRotate}
        >
          <Button
            size="small"
            icon={<ArrowsClockwise size={14} />}
            loading={isRotating}
            className="w-full sm:w-auto"
          >
            Regenerate
          </Button>
        </Popconfirm>
        <Button
          type="primary"
          icon={<Copy size={14} />}
          onClick={handleCopyLink}
          className="w-full sm:w-auto"
        >
          Copy link
        </Button>
      </div>
    </div>
  );
}
