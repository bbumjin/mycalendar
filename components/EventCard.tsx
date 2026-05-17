import Link from 'next/link';
import { MapPin, Bell } from 'lucide-react';
import { fmtTime, fmtDayMonth } from '@/lib/time';
import { ProviderBadge } from '@/components/ProviderBadge';
import type { EventRow } from '@/lib/types';

export function EventCard({ event, showDate = false }: { event: EventRow; showDate?: boolean }) {
  return (
    <Link
      href={`/event/${event.id}`}
      className="card p-4 flex items-start gap-4 hover:translate-y-[-1px] transition-transform"
    >
      <div className="text-right w-20 shrink-0">
        {showDate && <div className="text-xs text-[var(--muted)]">{fmtDayMonth(event.start_time)}</div>}
        <div className="font-medium tabular-nums">{fmtTime(event.start_time)}</div>
        <div className="text-xs text-[var(--muted)] tabular-nums">{fmtTime(event.end_time)}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate flex items-center gap-2">
          <ProviderBadge provider={event.source_provider} size="xs" />
          <span className="truncate">{event.title}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted)]">
          {event.location_text && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" />
              {event.location_text}
            </span>
          )}
          {event.reminders && event.reminders.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Bell className="w-3 h-3" />
              {event.reminders.length}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
