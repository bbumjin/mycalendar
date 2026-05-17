import { z } from 'zod';

// LLM extraction shape — mirrored by /api/extract and stored on event drafts.
// OpenAI structured output requires every property to be in `required`, so we use
// nullable instead of optional for absent fields.
export const ExtractionSchema = z.object({
  is_calendar_event: z.boolean(),
  title: z.string(),
  start_datetime: z.string(),
  end_datetime: z.string(),
  location_text: z.string().nullable(),
  attendees: z.array(z.string()),
  source_text_summary: z.string(),
  confidence: z.number().min(0).max(1),
  needs_user_confirmation: z.boolean(),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export type Reminder = { id?: string; minutes_before: number; method?: 'notification' | 'email' };

export type EventRow = {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location_text: string | null;
  attendees: string[];
  notes: string | null;
  source_text: string | null;
  source_type: 'text' | 'voice' | 'manual';
  ai_confidence: number | null;
  needs_confirmation: boolean;
  status: 'draft' | 'saved' | 'synced' | 'failed';
  calendar_account_id: string | null;
  external_event_id: string | null;
  created_at: string;
  updated_at: string;
  reminders?: Reminder[];
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  timezone: string;
  default_calendar_account_id: string | null;
  morning_briefing_time: string;
  night_briefing_time: string;
};
