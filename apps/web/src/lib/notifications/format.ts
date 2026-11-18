const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const fullFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** "just now", "5 min. ago", "3 hr. ago", "yesterday", then a plain date
 * once it's more than a week old. */
export function formatNotificationTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day');
  return dateFormat.format(then);
}

export function formatNotificationTimeFull(iso: string): string {
  return fullFormat.format(new Date(iso));
}
