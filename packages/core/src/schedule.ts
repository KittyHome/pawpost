/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SendWindow {
  timezone: string;
  days: readonly number[];
  /** Minutes after local midnight, inclusive. */
  startMinute: number;
  /** Minutes after local midnight, exclusive. Must be greater than startMinute. */
  endMinute: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS: Record<string, Weekday> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    formatterFor(timezone);
    return true;
  } catch {
    return false;
  }
}

export function localTimeParts(date: Date, timezone: string): { weekday: Weekday; minuteOfDay: number } {
  const parts = formatterFor(timezone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = WEEKDAYS[get("weekday")];
  if (!weekday) throw new Error(`Could not resolve weekday for ${timezone}`);
  return { weekday, minuteOfDay: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function isWithinSendWindow(now: Date, window: SendWindow): boolean {
  const { weekday, minuteOfDay } = localTimeParts(now, window.timezone);
  return window.days.includes(weekday) && minuteOfDay >= window.startMinute && minuteOfDay < window.endMinute;
}

export function validateSendWindow(window: SendWindow): string | null {
  if (!isValidTimezone(window.timezone)) return `Unknown timezone "${window.timezone}".`;
  if (window.days.length === 0) return "Pick at least one sending day.";
  if (window.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return "Sending days must be 1–7.";
  if (window.startMinute < 0 || window.endMinute > 24 * 60 || window.startMinute >= window.endMinute) {
    return "The sending window must start before it ends, within one day.";
  }
  return null;
}

/** When a follow-up becomes due. The send window still gates the actual send. */
export function followUpDueAt(sentAt: Date, waitDays: number): Date {
  return new Date(sentAt.getTime() + waitDays * DAY_MS);
}

/**
 * Gap before a mailbox may send again: the configured minimum plus up to 50%
 * random jitter, so sends don't land on a machine-regular rhythm.
 */
export function nextSendGapMs(minIntervalSeconds: number, random: () => number = Math.random): number {
  return Math.round(minIntervalSeconds * 1000 * (1 + random() * 0.5));
}

export function formatMinuteOfDay(minute: number): string {
  const h = Math.floor(minute / 60)
    .toString()
    .padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function parseTimeOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}
