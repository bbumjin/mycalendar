import { unstable_cache } from 'next/cache';
import { parseIcs } from '@/lib/ics-parser';
import { formatInTimeZone } from 'date-fns-tz';
import { DEFAULT_TZ } from '@/lib/time';

// Reliable, key-free Korean public-holiday source maintained by Google.
// Includes substitute holidays (대체공휴일) and temporary holidays (임시공휴일).
const HOLIDAY_ICS =
  'https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics';

type HolidayData = { dates: Set<string>; names: Map<string, string> };
// JSON-serializable shape stored in Next's data cache (Set/Map don't survive
// serialization, so we cache arrays and rebuild the collections per call).
type HolidayRaw = { dates: string[]; names: [string, string][] };

async function fetchHolidays(): Promise<HolidayRaw> {
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
  return { dates: Array.from(dates), names: Array.from(names) };
}

// Persist across serverless instances and survive cold starts: a module-level
// memo only lives for one warm lambda, so the previous version re-downloaded and
// re-parsed the full ICS on nearly every request. unstable_cache stores the
// result in Next's shared data cache and revalidates once a day.
const getCachedHolidays = unstable_cache(fetchHolidays, ['kr-holidays-v1'], {
  revalidate: 86400,
  tags: ['kr-holidays'],
});

export async function getKoreanHolidays(): Promise<HolidayData> {
  try {
    const raw = await getCachedHolidays();
    return { dates: new Set(raw.dates), names: new Map(raw.names) };
  } catch {
    return { dates: new Set(), names: new Map() };
  }
}
