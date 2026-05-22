import { format, addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const DEFAULT_TZ = 'Asia/Seoul';

export function fmtDayMonth(iso: string, tz = DEFAULT_TZ) {
  return formatInTimeZone(parseISO(iso), tz, 'M월 d일 (EEE)', { locale: ko });
}

export function fmtTime(iso: string, tz = DEFAULT_TZ) {
  return formatInTimeZone(parseISO(iso), tz, 'HH:mm', { locale: ko });
}

export function fmtTimeShort(iso: string, tz = DEFAULT_TZ) {
  return formatInTimeZone(parseISO(iso), tz, 'HH:mm', { locale: ko });
}

export function fmtDateTime(iso: string, tz = DEFAULT_TZ) {
  return formatInTimeZone(parseISO(iso), tz, "M월 d일 (EEE) • HH:mm", { locale: ko });
}

export function fmtDateLong(d: Date, tz = DEFAULT_TZ) {
  return formatInTimeZone(d, tz, 'yyyy년 M월 d일 EEEE', { locale: ko });
}

export function fmtMonthYear(d: Date, tz = DEFAULT_TZ) {
  return formatInTimeZone(d, tz, 'yyyy년 M월', { locale: ko });
}

export function todayRange(tz = DEFAULT_TZ) {
  const nowInTz = toZonedTime(new Date(), tz);
  return { from: startOfDay(nowInTz), to: endOfDay(nowInTz) };
}

export function weekRange(tz = DEFAULT_TZ) {
  const nowInTz = toZonedTime(new Date(), tz);
  return { from: startOfDay(nowInTz), to: endOfDay(addDays(nowInTz, 7)) };
}

export function monthRange(d: Date, tz = DEFAULT_TZ) {
  const z = toZonedTime(d, tz);
  return { from: startOfMonth(z), to: endOfMonth(z) };
}

export function isoForDate(d: Date) {
  return d.toISOString();
}

export function localInputValue(iso: string, tz = DEFAULT_TZ) {
  return formatInTimeZone(parseISO(iso), tz, "yyyy-MM-dd'T'HH:mm");
}

export function inputValueToIso(local: string, tz = DEFAULT_TZ) {
  const [datePart, timePart] = local.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  const tzString = new Date(utc).toLocaleString('en-US', { timeZone: tz, hour12: false });
  const guessed = new Date(tzString + ' UTC');
  const diff = guessed.getTime() - utc;
  return new Date(utc - diff).toISOString();
}

// Suppress unused import warning for format()
void format;
