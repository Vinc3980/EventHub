import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatCurrency,
  formatDateLong,
  formatListStamp,
  formatTicketDate,
  initials,
  relativeStamp,
} from '../../lib/format';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatCurrency', () => {
  it('renders two decimals by default', () => {
    expect(formatCurrency(80)).toBe('GHS 80.00');
    expect(formatCurrency(0)).toBe('GHS 0.00');
    expect(formatCurrency(1234.5)).toBe('GHS 1234.50');
  });

  it('drops trailing zeros when compact', () => {
    expect(formatCurrency(80, { compact: true })).toBe('GHS 80');
    expect(formatCurrency(80.5, { compact: true })).toBe('GHS 80.50');
    expect(formatCurrency(0, { compact: true })).toBe('GHS 0');
  });

  it('keeps the sign for negative amounts', () => {
    expect(formatCurrency(-40)).toBe('-GHS 40.00');
    expect(formatCurrency(-40, { compact: true })).toBe('-GHS 40');
  });
});

describe('formatDateLong', () => {
  it('renders "Mon, 5 October 2026"', () => {
    expect(formatDateLong(new Date(2026, 9, 5, 9, 30, 0))).toBe('Mon, 5 October 2026');
  });

  it('accepts ISO strings and epoch numbers', () => {
    const localIso = '2026-10-05T09:30:00';
    expect(formatDateLong(localIso)).toBe('Mon, 5 October 2026');
    expect(formatDateLong(new Date(2026, 9, 5, 9, 30, 0).getTime())).toBe(
      'Mon, 5 October 2026',
    );
  });
});

describe('formatTicketDate', () => {
  it('renders "3 Oct 2026, 14:00"', () => {
    expect(formatTicketDate(new Date(2026, 9, 3, 14, 0, 0))).toBe('3 Oct 2026, 14:00');
  });

  it('zero-pads the hour', () => {
    expect(formatTicketDate(new Date(2026, 0, 7, 8, 5, 0))).toBe('7 Jan 2026, 08:05');
  });
});

describe('formatListStamp', () => {
  const now = new Date(2026, 9, 5, 14, 30, 0); // Monday

  it('labels same-day stamps as Today', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    expect(formatListStamp(new Date(2026, 9, 5, 9, 12, 0))).toBe('Today, 09:12');
  });

  it('labels previous-day stamps as Yesterday', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    expect(formatListStamp(new Date(2026, 9, 4, 9, 12, 0))).toBe('Yesterday, 09:12');
  });

  it('falls back to an absolute weekday stamp', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    expect(formatListStamp(new Date(2026, 9, 2, 8, 5, 0))).toBe('Fri, 2 Oct, 08:05');
  });
});

describe('relativeStamp', () => {
  const now = new Date(2026, 9, 5, 14, 30, 0);

  it('bands the age of a timestamp', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    expect(relativeStamp(new Date(now.getTime() - 10_000))).toBe('now');
    expect(relativeStamp(new Date(now.getTime() - 2 * 60_000))).toBe('2m');
    expect(relativeStamp(new Date(now.getTime() - 59 * 60_000))).toBe('59m');
    expect(relativeStamp(new Date(now.getTime() - 3 * 3_600_000))).toBe('3h');
    expect(relativeStamp(new Date(now.getTime() - 5 * 86_400_000))).toBe('5d');
    expect(relativeStamp(new Date(now.getTime() - 14 * 86_400_000))).toBe('2w');
  });

  it('reports future timestamps as "now"', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    expect(relativeStamp(new Date(now.getTime() + 60_000))).toBe('now');
  });
});

describe('initials', () => {
  it('uses first and last name letters', () => {
    expect(initials('Kwame Asante')).toBe('KA');
    expect(initials('  ama   mensah ')).toBe('AM');
  });

  it('uses the first two letters for single names', () => {
    expect(initials('Cher')).toBe('CH');
  });

  it('never returns an empty string', () => {
    expect(initials('   ')).toBe('?');
  });
});
