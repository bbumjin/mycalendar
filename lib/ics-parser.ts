import { fromZonedTime } from 'date-fns-tz';
import { DEFAULT_TZ } from '@/lib/time';

export type ParsedEvent = {
  uid: string;
  title: string;
  start: string; // ISO UTC
  end: string; // ISO UTC
  allDay: boolean;
  location: string | null;
  description: string | null;
  cancelled: boolean;
};

// Unfold RFC 5545 folded lines: a CRLF followed by space/tab continues the previous line.
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// Parse a property line "KEY;PARAM=v;PARAM2=v2:VALUE" → { key, params, value }
function parseLine(line: string): { key: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(';');
  const key = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq > 0) params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
  }
  return { key, params, value };
}

// Convert an ICS date/time value to ISO UTC.
function icsDateToIso(value: string, tzid: string | undefined, isDate: boolean): { iso: string; allDay: boolean } {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!m) {
    const d = new Date(v);
    return { iso: Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(), allDay: isDate };
  }
  const [, y, mo, d, hh = '00', mi = '00', ss = '00', z] = m;
  const allDay = isDate || !v.includes('T');

  if (z) {
    return { iso: new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, +ss)).toISOString(), allDay };
  }
  // wall-clock time; interpret in TZID if present, else default tz
  const wall = `${y}-${mo}-${d}T${allDay ? '00' : hh}:${allDay ? '00' : mi}:${allDay ? '00' : ss}`;
  const zone = tzid || DEFAULT_TZ;
  try {
    return { iso: fromZonedTime(wall, zone).toISOString(), allDay };
  } catch {
    return { iso: fromZonedTime(wall, DEFAULT_TZ).toISOString(), allDay };
  }
}

export function parseIcs(text: string): ParsedEvent[] {
  const lines = unfold(text);
  const events: ParsedEvent[] = [];
  let cur: Partial<ParsedEvent> & { _startTzid?: string; _endTzid?: string; _startIsDate?: boolean; _endIsDate?: boolean } | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { cancelled: false };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur && cur.uid && cur.start && cur.end) {
        events.push({
          uid: cur.uid,
          title: cur.title || '(제목 없음)',
          start: cur.start,
          end: cur.end,
          allDay: cur.allDay ?? false,
          location: cur.location ?? null,
          description: cur.description ?? null,
          cancelled: cur.cancelled ?? false,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const p = parseLine(line);
    if (!p) continue;

    switch (p.key) {
      case 'UID':
        cur.uid = p.value.trim();
        break;
      case 'SUMMARY':
        cur.title = unescapeText(p.value);
        break;
      case 'LOCATION':
        cur.location = unescapeText(p.value) || null;
        break;
      case 'DESCRIPTION':
        cur.description = unescapeText(p.value) || null;
        break;
      case 'STATUS':
        if (p.value.trim().toUpperCase() === 'CANCELLED') cur.cancelled = true;
        break;
      case 'DTSTART': {
        const isDate = p.params['VALUE'] === 'DATE';
        const { iso, allDay } = icsDateToIso(p.value, p.params['TZID'], isDate);
        cur.start = iso;
        cur.allDay = allDay;
        break;
      }
      case 'DTEND': {
        const isDate = p.params['VALUE'] === 'DATE';
        const { iso } = icsDateToIso(p.value, p.params['TZID'], isDate);
        cur.end = iso;
        break;
      }
      default:
        break;
    }
  }

  // For events with DTSTART but no DTEND, default to +1h
  for (const e of events) {
    if (!e.end || e.end === e.start) {
      e.end = new Date(new Date(e.start).getTime() + 60 * 60 * 1000).toISOString();
    }
  }

  return events;
}
