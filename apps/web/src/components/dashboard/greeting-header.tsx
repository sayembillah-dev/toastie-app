const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

interface GreetingHeaderProps {
  firstName: string;
  clubName?: string;
  now: Date;
}

/** The dashboard's opening line — who's looking at it, which club they're in,
 * and today's date. Every member lands here first, so it stays short: no
 * numbers, no cards, just the "you are here" anchor for everything below. */
export function GreetingHeader({ firstName, clubName, now }: GreetingHeaderProps) {
  return (
    <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Hi, {firstName}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {clubName ? `${clubName} · ` : ''}
          {DATE_FMT.format(now)}
        </p>
      </div>
    </div>
  );
}
