import { parseIcs } from '@/lib/ics-parser';
import { formatInTimeZone } from 'date-fns-tz';
import { DEFAULT_TZ } from '@/lib/time';

// Reliable, key-free Korean public-holiday source maintained by Google.
// Includes substitute holidays (대체공휴일) and temporary holidays (임시공휴일).
const HOLIDAY_ICS =
  'https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics';

type HolidayData = { dates: Set<string>; names: Map<string, string> };

let cache: { data: HolidayData; fetchedAt: number } | null = null;
const TTL = 24 * 60 * 60 * 1000; // refresh once a day

export async function getKoreanHolidays(): Promise<HolidayData> {
  if (cache && Date.now() - cache.fetchedAt < TTL) return cache.data;

  try {
    const res = await fetch(HOLIDAY_ICS, { cache: 'no-store' });
    if (!res.ok) throw new Error(`holiday ICS ${res.status}`);
    const text = await res.text();
    const events = parseIcs(text);

    const dates = new Set<string>();
    const names = new Map<string, string>();
    for (const e of events) {
      // Google's calendar mixes real holidays (DESCRIPTION:공휴일) with mere
      // commemorative days (DESCRIPTION:기념일, e.g. 어버이날/스승의날). Only the
      // former are red days. Keep events whose description starts with 공휴일.
      const desc = (e.description ?? '').trim();
      if (!desc.startsWith('공휴일')) continue;

      // All-day events: [start, end) — end is exclusive in ICS. Expand the range.
      const start = new Date(e.start);
      const end = new Date(e.end);
      const cursor = new Date(start);
      let guard = 0;
      while (cursor < end && guard < 32) {
        const ymd = formatInTimeZone(cursor, DEFAULT_TZ, 'yyyy-MM-dd');
        dates.add(ymd);
        if (!names.has(ymd)) names.set(ymd, e.title);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        guard++;
      }
    }
    cache = { data: { dates, names }, fetchedAt: Date.now() };
    return cache.data;
  } catch {
    // On failure, return whatever we cached before, else empty.
    return cache?.data ?? { dates: new Set(), names: new Map() };
  }
}
