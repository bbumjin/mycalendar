import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_TZ } from '@/lib/time';
import { getKoreanHolidays } from '@/lib/holidays';
import { addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export type GridEvent = { id: string; title: string; start_time: string; end_time: string; all_day?: boolean };
export type MonthGrid = {
  month: string; // "yyyy-MM"
  events: GridEvent[];
  holidays: Record<string, string>; // "yyyy-MM-dd" -> name, within the grid range
};

// The 6-week grid range for a month, in the app's default zone.
export function monthGridRange(monthKey: string) {
  const anchor = toZonedTime(new Date(`${monthKey}-01T00:00:00+09:00`), DEFAULT_TZ);
  const gridStart = startOfWeek(startOfMonth(anchor));
  const gridEnd = endOfWeek(endOfMonth(anchor));
  return { anchor, gridStart, gridEnd };
}

// Single source of truth for a month's grid payload — used by both the
// /calendar server shell (initial paint) and the /api/calendar/month endpoint
// (client-side navigation), so they can never drift.
export async function getMonthGrid(
  supabase: SupabaseClient,
  userId: string,
  monthKey: string,
): Promise<MonthGrid> {
  const { gridStart, gridEnd } = monthGridRange(monthKey);

  const [{ data }, holidaysAll] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, start_time, end_time, all_day')
      .eq('user_id', userId)
      .gte('start_time', gridStart.toISOString())
      .lte('start_time', addDays(gridEnd, 1).toISOString())
      .order('start_time', { ascending: true }),
    getKoreanHolidays(),
  ]);

  const holidays: Record<string, string> = {};
  for (const d of eachDayOfInterval({ start: gridStart, end: gridEnd })) {
    const key = format(d, 'yyyy-MM-dd');
    if (holidaysAll.dates.has(key)) holidays[key] = holidaysAll.names.get(key) ?? '';
  }

  return { month: monthKey, events: (data as GridEvent[] | null) ?? [], holidays };
}
