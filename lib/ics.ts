// Minimal RFC 5545 iCalendar serializer for our event shape.
// Outputs CRLF line endings, folds long lines to 75 octets, escapes special chars.

import type { EventRow, Reminder } from '@/lib/types';

const PRODID = '-//AI Calendar//ai-calendar//KO';
const CRLF = '\r\n';

function escapeText(s: string): string {
  // RFC 5545 §3.3.11
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function fold(line: string): string {
  // Lines must not exceed 75 octets; continuation lines start with a single space.
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out: string[] = [];
  let buf = '';
  let octets = 0;
  for (const ch of line) {
    const w = Buffer.byteLength(ch, 'utf8');
    if (octets + w > 75) {
      out.push(buf);
      buf = ' ' + ch; // continuation prefix
      octets = 1 + w;
    } else {
      buf += ch;
      octets += w;
    }
  }
  if (buf.length > 0) out.push(buf);
  return out.join(CRLF);
}

function utcStamp(iso: string): string {
  // 20260519T060000Z
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function valarmFor(r: Reminder): string[] {
  return [
    'BEGIN:VALARM',
    `TRIGGER:-PT${r.minutes_before}M`,
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
  ];
}

function veventFor(e: EventRow): string[] {
  const lines: string[] = ['BEGIN:VEVENT'];
  lines.push(`UID:${e.id}@ai-calendar`);
  lines.push(`DTSTAMP:${utcStamp(e.updated_at || new Date().toISOString())}`);
  lines.push(`DTSTART:${utcStamp(e.start_time)}`);
  lines.push(`DTEND:${utcStamp(e.end_time)}`);
  lines.push(`SUMMARY:${escapeText(e.title)}`);
  if (e.location_text) lines.push(`LOCATION:${escapeText(e.location_text)}`);
  if (e.notes) lines.push(`DESCRIPTION:${escapeText(e.notes)}`);
  if (e.attendees && e.attendees.length > 0) {
    for (const a of e.attendees) {
      lines.push(`ATTENDEE;CN=${escapeText(a)}:mailto:invalid@example.invalid`);
    }
  }
  for (const r of e.reminders ?? []) {
    lines.push(...valarmFor(r));
  }
  lines.push('END:VEVENT');
  return lines;
}

export type CalendarMeta = {
  name?: string;
  description?: string;
  refreshIntervalMinutes?: number;
};

export function buildICalendar(events: EventRow[], meta: CalendarMeta = {}): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  if (meta.name) {
    lines.push(`X-WR-CALNAME:${escapeText(meta.name)}`);
    lines.push(`NAME:${escapeText(meta.name)}`);
  }
  if (meta.description) {
    lines.push(`X-WR-CALDESC:${escapeText(meta.description)}`);
  }
  if (meta.refreshIntervalMinutes) {
    lines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${meta.refreshIntervalMinutes}M`);
    lines.push(`X-PUBLISHED-TTL:PT${meta.refreshIntervalMinutes}M`);
  }

  for (const e of events) {
    lines.push(...veventFor(e));
  }
  lines.push('END:VCALENDAR');

  return lines.map(fold).join(CRLF) + CRLF;
}
