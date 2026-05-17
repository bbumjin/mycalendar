import { NextResponse, type NextRequest } from 'next/server';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ExtractionSchema } from '@/lib/types';
import { DEFAULT_TZ } from '@/lib/time';
import { requireUser } from '@/lib/supabase/server';
import { formatInTimeZone } from 'date-fns-tz';

export const runtime = 'nodejs';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const system = [
    `You convert messy natural language into a structured calendar event.`,
    `User timezone: ${tz}.`,
    `Current local time in user's timezone: ${nowLocal}.`,
    `Rules:`,
    `- Output start_datetime and end_datetime as full ISO 8601 with offset in the user's timezone.`,
    `- If no end time is stated, default to start + 1 hour.`,
    `- If the input is not a calendar event (greetings, questions, etc.), set is_calendar_event=false and put a placeholder title.`,
    `- Korean and English inputs are equally supported.`,
    `- Be conservative: if the date is ambiguous, set confidence below 0.6 and needs_user_confirmation=true.`,
    `- attendees should be plain names, not emails, unless an email is explicit.`,
    `- location_text is the raw location phrase from the user (e.g. "Gangnam Station Starbucks", "분당서울대병원").`,
  ].join('\n');

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: ExtractionSchema,
      system,
      prompt: text,
      temperature: 0,
    });
    return NextResponse.json({ event: object });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'extraction failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
