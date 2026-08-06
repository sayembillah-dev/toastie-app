'use client';

import { Microphone, Stop, TrashSimple, UploadSimple } from '@phosphor-icons/react/dist/ssr';
import { App, Button } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_RECORDING_SECONDS = 10 * 60;

interface AudioTabProps {
  audio: Blob | null;
  durationSec: number | null;
  onChange: (audio: Blob | null, durationSec: number | null) => void;
}

type Phase = 'idle' | 'requesting' | 'recording' | 'stopped' | 'unsupported' | 'denied';

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Picks the first mime type the browser will actually record. Safari on iOS
 * only supports `audio/mp4`; every other current browser handles webm/opus. */
function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function AudioTab({ audio, durationSec, onChange }: AudioTabProps) {
  const { message } = App.useApp();
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Playback URL — derived from the blob so the paired effect below only has
   * to revoke on change/unmount. Kept as a derivation rather than a piece of
   * state to avoid a redundant setState after every re-record. */
  const audioUrl = useMemo(() => (audio ? URL.createObjectURL(audio) : null), [audio]);
  useEffect(() => {
    if (!audioUrl) return;
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  function cleanupStream() {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  async function startRecording() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported');
      return;
    }
    const mimeType = pickRecorderMimeType();
    if (typeof MediaRecorder === 'undefined' || !mimeType) {
      setPhase('unsupported');
      return;
    }

    setPhase('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const runtime = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanupStream();
        if (blob.size > 0) {
          onChange(blob, runtime);
          setPhase('stopped');
        } else {
          setPhase('idle');
        }
      };

      startedAtRef.current = Date.now();
      setElapsed(0);
      recorder.start();
      setPhase('recording');

      tickRef.current = setInterval(() => {
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(seconds);
        if (seconds >= MAX_RECORDING_SECONDS && recorder.state !== 'inactive') {
          recorder.stop();
          message.info(`Recording stopped at the ${MAX_RECORDING_SECONDS / 60}-minute limit`);
        }
      }, 250);
    } catch (error) {
      cleanupStream();
      const name = error instanceof Error ? error.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPhase('denied');
      } else {
        setPhase('idle');
        message.error('Could not start recording. Try the upload option instead.');
      }
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function clearAudio() {
    onChange(null, null);
    setPhase('idle');
    setElapsed(0);
  }

  function handleFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onChange(file, null);
    setPhase('stopped');
    event.target.value = '';
  }

  const displaySeconds = phase === 'recording' ? elapsed : audio ? (durationSec ?? 0) : 0;
  const progress = Math.min(100, (displaySeconds / MAX_RECORDING_SECONDS) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-line bg-sidebar p-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={phase === 'recording' ? stopRecording : startRecording}
            disabled={phase === 'requesting'}
            aria-label={phase === 'recording' ? 'Stop recording' : 'Start recording'}
            className={`relative flex h-24 w-24 items-center justify-center rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-700/20 disabled:cursor-not-allowed ${
              phase === 'recording'
                ? 'border-red-500 bg-red-500 text-white shadow-[0_0_0_6px_rgba(239,68,68,0.15)]'
                : 'border-line-strong bg-canvas text-ink hover:border-ink hover:shadow-sm active:scale-95'
            }`}
          >
            {phase === 'recording' ? (
              <Stop size={28} weight="fill" />
            ) : (
              <Microphone size={28} weight="fill" />
            )}
            {phase === 'recording' ? (
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-1 rounded-full border-2 border-red-400/40 motion-safe:animate-ping"
              />
            ) : null}
          </button>

          <div className="text-center">
            <p className="tabular-nums text-2xl font-semibold text-ink">
              {formatMmSs(displaySeconds)}
            </p>
            <p className="text-[11px] text-ink-muted">
              {phase === 'recording'
                ? `Recording — max ${MAX_RECORDING_SECONDS / 60} min`
                : phase === 'requesting'
                  ? 'Requesting microphone…'
                  : audio
                    ? 'Preview your take, then keep it or record again.'
                    : 'Tap the button to record a spoken evaluation.'}
            </p>
          </div>

          <div className="h-1 w-full max-w-sm overflow-hidden rounded-full bg-fill">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${
                phase === 'recording' ? 'bg-red-500' : 'bg-ink/60'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {audio && audioUrl && phase !== 'recording' ? (
          <div className="mt-5 flex flex-col gap-3">
            {/* biome-ignore lint/a11y/useMediaCaption: user-recorded spoken feedback — no caption track exists. */}
            <audio controls src={audioUrl} className="w-full" preload="metadata" />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                icon={<TrashSimple size={16} />}
                onClick={clearAudio}
                aria-label="Discard recording"
              >
                Discard
              </Button>
              <Button
                type="primary"
                icon={<Microphone size={16} weight="fill" />}
                onClick={startRecording}
              >
                Record again
              </Button>
            </div>
          </div>
        ) : null}

        {phase === 'denied' ? (
          <p className="mt-4 rounded-lg border border-line bg-fill/60 px-3 py-2 text-[12px] text-ink-soft">
            Microphone access was blocked. You can still upload an audio file below, or enable mic
            permissions in your browser settings and try again.
          </p>
        ) : null}
        {phase === 'unsupported' ? (
          <p className="mt-4 rounded-lg border border-line bg-fill/60 px-3 py-2 text-[12px] text-ink-soft">
            In-browser recording isn&apos;t supported here. Please upload an audio file instead.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-dashed border-line-strong px-5 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Prefer to attach a file?</p>
            <p className="text-[11px] text-ink-muted">
              Any voice memo works — .m4a, .mp3, .wav, .webm.
            </p>
          </div>
          <Button
            icon={<UploadSimple size={16} weight="bold" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload audio
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFilePicked}
        />
      </div>
    </div>
  );
}
