/**
 * Formatting helpers — GHS currency and Ghana-style dates, matching the
 * mobile app (`lib/widgets/*` money/date helpers).
 */

const TZ = 'Africa/Accra';

/** GHS 80.00 in summaries/receipts, GHS 80 on CTAs. */
export function formatCurrency(amount: number, opts: { compact?: boolean } = {}): string {
  const n = Math.abs(amount);
  const body = opts.compact
    ? Number.isInteger(n)
      ? n.toString()
      : n.toFixed(2)
    : n.toFixed(2);
  const sign = amount < 0 ? '-' : '';
  return `${sign}GHS ${body}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toGhanaDate(input: Date | string | number): Date {
  return input instanceof Date ? new Date(input.getTime()) : new Date(input);
}

/** "Mon, 5 October 2026" */
export function formatDateLong(input: Date | string | number): string {
  const d = toGhanaDate(input);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 October 2026" */
export function formatDateMedium(input: Date | string | number): string {
  const d = toGhanaDate(input);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Sat, 12 Oct" — event cards */
export function formatDateCard(input: Date | string | number): string {
  const d = toGhanaDate(input);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** "14:00" in Africa/Accra */
export function formatTime(input: Date | string | number): string {
  const d = toGhanaDate(input);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

export function formatDateTime(input: Date | string | number): string {
  return `${formatDateLong(input)}, ${formatTime(input)}`;
}

/** "3 Oct 2026, 14:00" — tickets/receipts */
export function formatTicketDate(input: Date | string | number): string {
  const d = toGhanaDate(input);
  const mon = MONTHS[d.getMonth()].slice(0, 3);
  return `${d.getDate()} ${mon} ${d.getFullYear()}, ${formatTime(d)}`;
}

/** "Today, 14:00" | "Yesterday, 09:12" | "Mon, 12 Oct, 14:00" — chat rows */
export function formatListStamp(input: Date | string | number): string {
  const d = toGhanaDate(input);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(now.getTime() - 86400000);
  if (sameDay(d, now)) return `Today, ${formatTime(d)}`;
  if (sameDay(d, yesterday)) return `Yesterday, ${formatTime(d)}`;
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}, ${formatTime(d)}`;
}

/** Age band for relative timestamps: "2m", "3h", "5d" */
export function relativeStamp(input: Date | string | number): string {
  const ms = Date.now() - toGhanaDate(input).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : (plural ?? `${singular}s`);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function initialsColor(name: string): string {
  // Stable neutral tint derived from the name — no new hex (uses token tints
  // through the numeric index below, resolved by the Avatar component).
  const sum = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return String(sum % 6);
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return digits;
  return `${digits.slice(0, 3)} *** ${digits.slice(-3)}`;
}
