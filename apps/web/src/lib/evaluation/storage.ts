/**
 * Public evaluation submissions live outside the authenticated app — the link
 * is meant to be shared with anyone on the meeting roster (or scanned as a
 * QR), so the flow can't lean on the RTK Query / localStorage-backed API the
 * rest of the app uses.
 *
 * Until the destination is wired up server-side these helpers keep the
 * identity gate and submissions in localStorage under a stable key prefix.
 * Swap the writes for a POST once the API lands — the callers won't need to
 * change.
 */

const KEY_PREFIX = 'toastly:evaluation';

export interface EvaluatorIdentity {
  name: string;
  /** True when the visitor confirmed they are the assigned evaluator. */
  isAssignedEvaluator: boolean;
  /** ISO string — recorded once the gate is answered so we don't ask again. */
  confirmedAt: string;
}

function identityKey(meetingId: string, speakerId: string): string {
  return `${KEY_PREFIX}:identity:${meetingId}:${speakerId}`;
}

function submissionsKey(meetingId: string, speakerId: string): string {
  return `${KEY_PREFIX}:submissions:${meetingId}:${speakerId}`;
}

/* In-tab pub/sub for identity writes. localStorage's `storage` event only
 * fires across tabs, but `useSyncExternalStore` needs a same-tab signal so a
 * write triggers a re-render on the same page that wrote it. */
type IdentityListener = () => void;
const identityListeners = new Map<string, Set<IdentityListener>>();

function notifyIdentityListeners(key: string): void {
  const set = identityListeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

/* Same pub/sub for submission writes. Two flavours:
 *  - per-slot listeners keyed by the slot's localStorage key — the Prepared
 *    Speakers indicator only cares about its own speaker.
 *  - global listeners — the Me page reads submissions across every meeting/
 *    speaker, so it can't subscribe to a single key.
 * Both fire on every write; a single write notifies its slot AND every global
 * listener. */
type SubmissionListener = () => void;
const submissionListeners = new Map<string, Set<SubmissionListener>>();
const submissionGlobalListeners = new Set<SubmissionListener>();

function notifySubmissionListeners(key: string): void {
  const set = submissionListeners.get(key);
  if (set) for (const listener of set) listener();
  for (const listener of submissionGlobalListeners) listener();
}

export function subscribeToIdentity(
  meetingId: string,
  speakerId: string,
  listener: IdentityListener,
): () => void {
  const key = identityKey(meetingId, speakerId);
  let set = identityListeners.get(key);
  if (!set) {
    set = new Set();
    identityListeners.set(key, set);
  }
  set.add(listener);

  const storageHandler = (event: StorageEvent) => {
    if (event.key === key) listener();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }

  return () => {
    set!.delete(listener);
    if (set!.size === 0) identityListeners.delete(key);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
}

/** Raw JSON snapshot for `useSyncExternalStore` — the string reference is
 * stable between renders when the underlying value hasn't changed. */
export function readIdentityRaw(meetingId: string, speakerId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(identityKey(meetingId, speakerId));
  } catch {
    return null;
  }
}

export function parseIdentity(raw: string | null): EvaluatorIdentity | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EvaluatorIdentity;
    if (!parsed || typeof parsed.name !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeIdentity(
  meetingId: string,
  speakerId: string,
  identity: Omit<EvaluatorIdentity, 'confirmedAt'>,
): EvaluatorIdentity {
  const stamped: EvaluatorIdentity = {
    ...identity,
    confirmedAt: new Date().toISOString(),
  };
  const key = identityKey(meetingId, speakerId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(stamped));
    } catch {
      /* Storage full or blocked — the caller still keeps in-memory state. */
    }
  }
  notifyIdentityListeners(key);
  return stamped;
}

export function clearIdentity(meetingId: string, speakerId: string): void {
  const key = identityKey(meetingId, speakerId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  notifyIdentityListeners(key);
}

/** A submission as we keep it locally — audio/images are stored as data URLs
 * so a JSON round trip through localStorage survives. Real backend will take
 * multipart FormData instead.
 *
 * `speakerMemberId` and `meetingNumber` are stamped at write time so the Me
 * page can list a member's incoming feedback without needing the Redux
 * meeting draft in context — the two IDs (meetingId + speakerId) alone don't
 * reveal who the speaker is once the draft is out of scope. */
export interface StoredEvaluationSubmission {
  id: string;
  meetingId: string;
  speakerId: string;
  /** memberId of the speaker who received the feedback (from the draft at
   * submit time). Optional — very old submissions from before this stamp
   * lands may not have it. */
  speakerMemberId?: string;
  /** Meeting number at submit time. Optional for the same reason. */
  meetingNumber?: number;
  /** Free-text speech title from the draft — captured so the Me page can
   * label a card even if the draft has since been edited or cleared. */
  speechTitle?: string;
  evaluator: EvaluatorIdentity;
  submittedAt: string;
  audioDataUrl?: string;
  audioMimeType?: string;
  audioDurationSec?: number;
  imageDataUrls: string[];
  text?: string;
}

export interface SubmitEvaluationInput {
  meetingId: string;
  speakerId: string;
  speakerMemberId?: string;
  meetingNumber?: number;
  speechTitle?: string;
  evaluator: EvaluatorIdentity;
  audio?: Blob;
  audioDurationSec?: number;
  images: File[];
  text?: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });
}

export async function submitEvaluation(
  input: SubmitEvaluationInput,
): Promise<StoredEvaluationSubmission> {
  const [audioDataUrl, ...imageDataUrls] = await Promise.all([
    input.audio ? blobToDataUrl(input.audio) : Promise.resolve<string | undefined>(undefined),
    ...input.images.map((image) => blobToDataUrl(image)),
  ]);

  const submission: StoredEvaluationSubmission = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sub_${Math.random().toString(36).slice(2)}`,
    meetingId: input.meetingId,
    speakerId: input.speakerId,
    speakerMemberId: input.speakerMemberId,
    meetingNumber: input.meetingNumber,
    speechTitle: input.speechTitle?.trim() ? input.speechTitle.trim() : undefined,
    evaluator: input.evaluator,
    submittedAt: new Date().toISOString(),
    audioDataUrl,
    audioMimeType: input.audio?.type,
    audioDurationSec: input.audioDurationSec,
    imageDataUrls,
    text: input.text?.trim() ? input.text.trim() : undefined,
  };

  if (typeof window !== 'undefined') {
    const key = submissionsKey(input.meetingId, input.speakerId);
    try {
      const existing = window.localStorage.getItem(key);
      const list: StoredEvaluationSubmission[] = existing ? JSON.parse(existing) : [];
      list.push(submission);
      window.localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* Ignore — the promise still resolves so the UI can show success. When
       * the real backend lands, network failures will surface here instead. */
    }
    notifySubmissionListeners(key);
  }

  return submission;
}

/** Read the submissions stored for one speaker slot. Empty array when the
 * key doesn't exist or the JSON is corrupt — never throws. */
export function readSubmissions(
  meetingId: string,
  speakerId: string,
): StoredEvaluationSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(submissionsKey(meetingId, speakerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredEvaluationSubmission[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Read every submission across every slot in this browser and return those
 * that were submitted for the given member. Used by the Me page — the caller
 * groups results by (meetingId, speakerId) themselves. */
export function readSubmissionsForMember(memberId: string): StoredEvaluationSubmission[] {
  if (typeof window === 'undefined') return [];
  const prefix = `${KEY_PREFIX}:submissions:`;
  const found: StoredEvaluationSubmission[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const list = JSON.parse(raw) as StoredEvaluationSubmission[];
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
          if (entry.speakerMemberId === memberId) found.push(entry);
        }
      } catch {
        /* Skip corrupt entries — one bad key shouldn't blank the whole feed. */
      }
    }
  } catch {
    /* localStorage inaccessible (private mode, quota errors, etc.). */
  }
  return found;
}

/** Subscribe to writes for a single speaker slot — used by the Prepared
 * Speakers indicator so its count updates the moment a submission lands in
 * the same tab. */
export function subscribeToSubmissions(
  meetingId: string,
  speakerId: string,
  listener: SubmissionListener,
): () => void {
  const key = submissionsKey(meetingId, speakerId);
  let set = submissionListeners.get(key);
  if (!set) {
    set = new Set();
    submissionListeners.set(key, set);
  }
  set.add(listener);

  const storageHandler = (event: StorageEvent) => {
    if (event.key === key) listener();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }

  return () => {
    set!.delete(listener);
    if (set!.size === 0) submissionListeners.delete(key);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
}

/** Subscribe to writes across every slot — used by the Me page which reads
 * submissions for a member and doesn't know the slot keys up front. */
export function subscribeToAllSubmissions(listener: SubmissionListener): () => void {
  submissionGlobalListeners.add(listener);

  const storageHandler = (event: StorageEvent) => {
    if (event.key?.startsWith(`${KEY_PREFIX}:submissions:`)) listener();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }

  return () => {
    submissionGlobalListeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
}
