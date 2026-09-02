'use client';

import {
  BookOpen,
  ChatCircleText,
  FloppyDisk,
  Palette,
  Quotes,
  TextAa,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Input, Select } from 'antd';
import { useMemo } from 'react';
import { ReadOnly } from '@/components/permissions/read-only';
import type { WordOfTheDay } from '@/lib/meetings/draft';
import type { Meeting } from '@/lib/meetings/meetings';
import { useUpdateMeetingMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectMeetingDraft, themeChanged, wordChanged } from '@/store/meeting-draft-slice';

/* The classic English parts of speech. Ordered roughly by usage frequency so
 * the top options in the dropdown match what a Grammarian is most likely to
 * pick. */
const PARTS_OF_SPEECH = [
  'Noun',
  'Verb',
  'Adjective',
  'Adverb',
  'Pronoun',
  'Preposition',
  'Conjunction',
  'Interjection',
  'Determiner',
] as const;

interface FieldProps {
  id: string;
  label: string;
  helper?: string;
  Icon: React.ComponentType<{
    size?: number;
    weight?: 'regular' | 'bold' | 'fill';
    className?: string;
  }>;
  children: React.ReactNode;
}

/** Uniform label + control wrapper, borrowed from the Start-Pathway modal so
 * both places read as the same design system. */
function Field({ id, label, helper, Icon, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink">
        <Icon size={12} weight="bold" className="text-ink-muted" />
        {label}
      </label>
      {children}
      {helper ? <p className="mt-1.5 text-[11px] text-ink-muted">{helper}</p> : null}
    </div>
  );
}

interface ThemeTabProps {
  meeting: Meeting;
}

/** Everything on this tab lives on the meeting record, so "has it changed?"
 * is a straight comparison against what the API last returned. */
function isDirty(meeting: Meeting, theme: string, word: WordOfTheDay): boolean {
  const saved = meeting.word;
  return (
    theme.trim() !== meeting.theme ||
    word.word.trim() !== (saved?.word ?? '') ||
    (word.partOfSpeech ?? '') !== (saved?.partOfSpeech ?? '') ||
    word.meaning.trim() !== (saved?.meaning ?? '') ||
    word.example.trim() !== (saved?.example ?? '')
  );
}

/** Theme tab body — the meeting's theme and the grammarian's word-of-the-day
 * breakdown. Both live on the meeting record and are committed by this tab's
 * own Save; the draft they pass through is what the Overview → Agenda sheet
 * prints from, so the preview stays live while you type. */
export function ThemeTab({ meeting }: ThemeTabProps) {
  const dispatch = useAppDispatch();
  const draft = useAppSelector((state) => selectMeetingDraft(state, meeting.id));
  const { word } = draft;
  const { message } = App.useApp();
  const [updateMeeting, { isLoading: isSaving }] = useUpdateMeetingMutation();

  const dirty = useMemo(() => isDirty(meeting, draft.theme, word), [meeting, draft.theme, word]);

  async function handleSave() {
    if (draft.theme.trim() === '') {
      message.error('Give the meeting a theme before saving.');
      return;
    }
    try {
      await updateMeeting({
        meetingId: meeting.id,
        theme: draft.theme.trim(),
        word: {
          word: word.word.trim(),
          partOfSpeech: word.partOfSpeech ?? '',
          meaning: word.meaning.trim(),
          example: word.example.trim(),
        },
      }).unwrap();
      message.success('Theme and word of the day saved');
    } catch (error) {
      message.error(getApiErrorMessage(error, "Couldn't save the theme. Please try again."));
    }
  }

  return (
    /* Panel chrome (border/surface/padding) starts at `md` — on phones this
     * renders inside the full-width drawer, which already provides both. */
    <section className="mx-auto max-w-2xl md:rounded-2xl md:border md:border-line md:bg-canvas md:p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-ink">Theme &amp; Word of the Day</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Set the meeting&apos;s theme and the grammarian&apos;s word of the day so members can
          weave both into their speeches.
        </p>
      </div>

      <ReadOnly resource="meeting" display="block" className="flex flex-col gap-4">
        <Field id="theme-of-the-day" label="Theme of the day" Icon={Palette}>
          <Input
            id="theme-of-the-day"
            size="large"
            placeholder="e.g. New Beginnings"
            value={draft.theme}
            onChange={(event) =>
              dispatch(themeChanged({ meetingId: meeting.id, theme: event.target.value }))
            }
            maxLength={80}
            showCount
          />
        </Field>

        {/* Word + part-of-speech stack on phones and sit side-by-side on
         * anything wider — the part-of-speech is short and reads well next to
         * the word rather than beneath it. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <Field id="word-of-the-day" label="Word of the day" Icon={TextAa}>
            <Input
              id="word-of-the-day"
              size="large"
              placeholder="e.g. Ephemeral"
              value={word.word}
              onChange={(event) =>
                dispatch(
                  wordChanged({ meetingId: meeting.id, patch: { word: event.target.value } }),
                )
              }
              maxLength={40}
            />
          </Field>

          <Field id="part-of-speech" label="Part of speech" Icon={BookOpen}>
            <Select
              id="part-of-speech"
              size="large"
              className="w-full sm:w-44"
              placeholder="Select"
              options={PARTS_OF_SPEECH.map((part) => ({ value: part, label: part }))}
              value={word.partOfSpeech}
              onChange={(value) =>
                dispatch(wordChanged({ meetingId: meeting.id, patch: { partOfSpeech: value } }))
              }
              allowClear
            />
          </Field>
        </div>

        <Field
          id="word-meaning"
          label="Meaning"
          Icon={ChatCircleText}
          helper="A short, plain-language definition that fits on one line when read aloud."
        >
          <Input.TextArea
            id="word-meaning"
            size="large"
            placeholder="A concise definition of the word."
            value={word.meaning}
            onChange={(event) =>
              dispatch(
                wordChanged({ meetingId: meeting.id, patch: { meaning: event.target.value } }),
              )
            }
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={240}
            showCount
          />
        </Field>

        <Field
          id="word-example"
          label="Example sentence"
          Icon={Quotes}
          helper="A sentence that shows the word in use — bonus points if it hints at the theme."
        >
          <Input.TextArea
            id="word-example"
            size="large"
            placeholder="Show the word in context."
            value={word.example}
            onChange={(event) =>
              dispatch(
                wordChanged({ meetingId: meeting.id, patch: { example: event.target.value } }),
              )
            }
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={240}
            showCount
          />
        </Field>
      </ReadOnly>

      {/* Full-width on phones so the button is an easy thumb target, and
       * right-aligned from sm up where the card has room. */}
      <div className="mt-6 flex flex-col items-stretch gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-end">
        <span aria-live="polite" className="text-xs text-ink-muted sm:mr-auto">
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <ReadOnly resource="meeting">
          <Button
            type="primary"
            size="middle"
            icon={<FloppyDisk size={14} weight="bold" />}
            disabled={!dirty}
            loading={isSaving}
            onClick={() => {
              void handleSave();
            }}
          >
            Save
          </Button>
        </ReadOnly>
      </div>
    </section>
  );
}
