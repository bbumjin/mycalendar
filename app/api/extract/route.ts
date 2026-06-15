import { NextResponse, type NextRequest } from 'next/server';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { MultiExtractionSchema, type Extraction } from '@/lib/types';
import { DEFAULT_TZ } from '@/lib/time';
import { requireUser } from '@/lib/supabase/server';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { addDays, startOfWeek } from 'date-fns';

export const runtime = 'nodejs';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// Build a reference table mapping Korean/English relative date phrases to concrete YYYY-MM-DD (in user TZ).
// LLM is much better at picking from this table than computing weekdays itself.
function buildDateReference(nowDate: Date, tz: string): string {
  const nowZ = toZonedTime(nowDate, tz);
  const fmt = (d: Date) => formatInTimeZone(d, tz, 'yyyy-MM-dd');
  const wdEn = (d: Date) => WD_EN[Number(formatInTimeZone(d, tz, 'i')) % 7];
  const wdKo = (d: Date) => WD_KO[Number(formatInTimeZone(d, tz, 'i')) % 7];

  // Korean convention: weeks start Monday. startOfWeek weekStartsOn=1.
  const thisMon = startOfWeek(nowZ, { weekStartsOn: 1 });

  const todayLine = `오늘 = today = ${fmt(nowZ)} (${wdKo(nowZ)} / ${wdEn(nowZ)})`;
  const dayLines = [
    `내일 = tomorrow = ${fmt(addDays(nowZ, 1))} (${wdKo(addDays(nowZ, 1))})`,
    `모레 = day after tomorrow = ${fmt(addDays(nowZ, 2))} (${wdKo(addDays(nowZ, 2))})`,
    `글피 = three days from now = ${fmt(addDays(nowZ, 3))} (${wdKo(addDays(nowZ, 3))})`,
  ];

  function weekTable(label: string, weekMon: Date): string {
    const lines: string[] = [`${label}:`];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekMon, i);
      lines.push(`  ${WD_KO[Number(formatInTimeZone(d, tz, 'i')) % 7]} = ${WD_EN[Number(formatInTimeZone(d, tz, 'i')) % 7]} = ${fmt(d)}`);
    }
    return lines.join('\n');
  }

  return [
    todayLine,
    ...dayLines,
    '',
    weekTable('이번 주 (this week, Mon-Sun)', thisMon),
    '',
    weekTable('다음 주 (next week)', addDays(thisMon, 7)),
    '',
    weekTable('다다음주 (the week after next)', addDays(thisMon, 14)),
    '',
    weekTable('다다다음주 (three weeks from now)', addDays(thisMon, 21)),
  ].join('\n');
}

// Verify the extracted weekday matches the literal weekday mentioned in the input.
function validateWeekday(
  extraction: Extraction,
  originalText: string,
  tz: string,
  nowDate: Date
): {
  ok: boolean;
  reason?: string;
} {
  let extractedDate: Date;
  try {
    extractedDate = new Date(extraction.start_datetime);
    if (Number.isNaN(extractedDate.getTime())) return { ok: true };
  } catch {
    return { ok: true };
  }

  // --- Weekday check ---
  const koMatch = WD_KO.findIndex((w) => originalText.includes(w));
  const enMatch = WD_EN.findIndex((w) => new RegExp(`\\b${w}\\b`, 'i').test(originalText));
  const mentionedDow = koMatch >= 0 ? koMatch : enMatch >= 0 ? enMatch : -1;
  if (mentionedDow >= 0) {
    const extractedDow = Number(formatInTimeZone(extractedDate, tz, 'i')) % 7;
    if (extractedDow !== mentionedDow) {
      return {
        ok: false,
        reason: `입력은 "${WD_KO[mentionedDow]}"인데 추출된 날짜는 "${WD_KO[extractedDow]}"입니다.`,
      };
    }
  }

  // --- Week-offset check (이번 주 / 다음 주 / 다다음주 / 다다다음주 …) ---
  const ibun = /(이번\s*주)/.test(originalText) ? 0 : -1;
  const nextWeek = originalText.match(/(다*)다음\s*주/);
  let expectedOffset = -1;
  if (ibun === 0) expectedOffset = 0;
  else if (nextWeek) expectedOffset = 1 + nextWeek[1].length;

  if (expectedOffset >= 0) {
    const todayZ = toZonedTime(nowDate, tz);
    const thisMon = startOfWeek(todayZ, { weekStartsOn: 1 });
    const expectedMon = addDays(thisMon, expectedOffset * 7);
    const expectedSun = addDays(expectedMon, 6);

    // Get extracted date's YYYY-MM-DD in tz
    const extractedYmd = formatInTimeZone(extractedDate, tz, 'yyyy-MM-dd');
    const monYmd = formatInTimeZone(expectedMon, tz, 'yyyy-MM-dd');
    const sunYmd = formatInTimeZone(expectedSun, tz, 'yyyy-MM-dd');

    if (extractedYmd < monYmd || extractedYmd > sunYmd) {
      const weekLabel =
        expectedOffset === 0 ? '이번 주' :
        expectedOffset === 1 ? '다음 주' :
        expectedOffset === 2 ? '다다음주' :
        '다'.repeat(expectedOffset - 1) + '다음주';
      return {
        ok: false,
        reason: `"${weekLabel}" (${monYmd} ~ ${sunYmd}) 범위를 벗어났습니다. 추출된 날짜: ${extractedYmd}.`,
      };
    }
  }

  return { ok: true };
}

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { text, timezone, now } = await req.json().catch(() => ({}));
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }

  const tz = (typeof timezone === 'string' && timezone) || DEFAULT_TZ;
  const nowDate = typeof now === 'string' && now ? new Date(now) : new Date();
  const nowLocal = formatInTimeZone(nowDate, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const dateReference = buildDateReference(nowDate, tz);

  const system = [
    `You convert messy natural language into one or more structured calendar events.`,
    `User timezone: ${tz}.`,
    `Current local time in user's timezone: ${nowLocal}.`,
    ``,
    `IMPORTANT — use this date reference table (in ${tz}) instead of computing weekdays yourself:`,
    dateReference,
    ``,
    `Rules:`,
    `- Return an "events" array with ONE object per distinct calendar event.`,
    `- A single message may contain MULTIPLE events — split them. They may share a date but have different times, or span different dates. Example: "6월 25일 10시 제이에스 미팅, 14시 내부 미팅" → TWO events on the same date: one at 10:00 titled "제이에스 미팅", one at 14:00 titled "내부 미팅". A date/place mentioned once applies to following events until a new one is given.`,
    `- Output start_datetime and end_datetime as full ISO 8601 with offset in the user's timezone.`,
    `- For relative date phrases (오늘, 내일, 모레, 이번 주 X요일, 다음 주 X요일, 다다음주 X요일, etc.), LOOK UP the date in the reference table above. Do NOT compute weekdays yourself.`,
    `- The day-of-week of start_datetime MUST match the weekday the user mentioned. If you cannot determine which week is meant, set confidence below 0.6 and needs_user_confirmation=true.`,
    `- If no end time is stated, default to start + 1 hour.`,
    `- If the input is not a calendar event at all (greetings, questions, etc.), return an empty events array.`,
    `- Korean and English inputs are equally supported.`,
    `- TITLE LANGUAGE: keep each title in the SAME language the user wrote it in. NEVER translate. Korean input → Korean title; English input → English title. Preserve proper nouns and company names exactly as written (e.g. "제이에스", "JS").`,
    `- Be conservative: if the date is ambiguous, set confidence below 0.6 and needs_user_confirmation=true.`,
    `- attendees MUST contain ONLY explicit email addresses found in the text. Do NOT include plain names. If no email address is present, return an empty attendees array.`,
    `- location_text is the raw location phrase from the user (e.g. "강남역 스타벅스", "분당서울대병원").`,
    `- Before returning, double-check each event: does the day-of-week of start_datetime match the weekday phrase in the user's text? If mismatch, fix it.`,
  ].join('\n');

  try {
    const { object } = await generateObject({
      // Upgraded from gpt-4o-mini → gpt-4o for materially better Korean weekday/ordinal reasoning.
      // Cost is small relative to one extraction; user trust on confirmation screen matters more.
      model: openai('gpt-4o-2024-08-06'),
      schema: MultiExtractionSchema,
      system,
      prompt: text,
      temperature: 0,
    });

    const events = object.events.map((ev) => {
      // Enforce email-only attendees regardless of what the model returned.
      const cleaned: Extraction = { ...ev, attendees: ev.attendees.filter(isEmail) };

      // Server-side validation: if the user said a weekday/week and we picked something else, flag low confidence.
      const check = validateWeekday(cleaned, text, tz, nowDate);
      if (!check.ok) {
        return {
          event: {
            ...cleaned,
            confidence: Math.min(cleaned.confidence, 0.5),
            needs_user_confirmation: true,
          },
          warning: `날짜 추출이 입력과 다를 수 있습니다. ${check.reason} 확인해주세요.`,
        };
      }
      return { event: cleaned };
    });

    return NextResponse.json({ events });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'extraction failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
