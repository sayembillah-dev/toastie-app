'use client';

import { Sparkle } from '@phosphor-icons/react/dist/ssr';
import { Input } from 'antd';

const { TextArea } = Input;

const MAX_TEXT_LENGTH = 4000;

interface TextExample {
  key: string;
  label: string;
  body: string;
}

/** Three seed prompts the writer can append to their draft — meant to unblock
 * a first sentence rather than replace the writer's voice. The labels mirror
 * how Toastmasters evaluators are trained to structure feedback. */
const EXAMPLES: TextExample[] = [
  {
    key: 'commend',
    label: 'What worked well',
    body: 'Your opening line pulled me in — the pause after your first sentence let it land. That is exactly the kind of vocal variety this project asks for, and you sustained it right through the middle of the speech.',
  },
  {
    key: 'build',
    label: 'What to build on',
    body: 'The middle stretch leaned on a few filler words — I noticed "you know" about half a dozen times. Try trading one of those for a two-second pause. It will feel long to you, and short to us.',
  },
  {
    key: 'challenge',
    label: 'A challenge for next time',
    body: 'Pick three audience anchors — one on the left, one in the middle, one on the right — and hold each of them for a full sentence. That is a small change with a big projection payoff, and it fits neatly into your next project.',
  },
];

interface TextTabProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextTab({ value, onChange }: TextTabProps) {
  function appendExample(example: TextExample) {
    const heading = `${example.label}\n`;
    const separator = value.trim().length > 0 ? '\n\n' : '';
    const next = `${value}${separator}${heading}${example.body}`;
    onChange(next.slice(0, MAX_TEXT_LENGTH));
  }

  const remaining = MAX_TEXT_LENGTH - value.length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Insert an example to start
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.key}
              type="button"
              onClick={() => appendExample(example)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-canvas px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-ink hover:bg-fill/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-1"
            >
              <Sparkle size={13} weight="fill" className="text-ink-muted" />
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="evaluation-text" className="mb-1.5 block text-xs font-medium text-ink">
          Written feedback
        </label>
        <TextArea
          id="evaluation-text"
          autoSize={{ minRows: 8, maxRows: 20 }}
          maxLength={MAX_TEXT_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Share what worked, what could be even stronger, and one thing to try in the next speech…"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-ink-muted">
          <p>
            Tip: mix specifics with encouragement. The speaker cares more about the
            &ldquo;why&rdquo; than the score.
          </p>
          <p className="tabular-nums">{remaining} left</p>
        </div>
      </div>
    </div>
  );
}
