'use client';

import { CalendarPlus } from 'lucide-react';

// Triggers download of an .ics file. On iOS Safari this surfaces the system
// "Add to Calendar" sheet automatically. On Android Chrome it downloads or
// hands off to the default calendar app.
export function AddToCalendarButton({ eventId, className }: { eventId: string; className?: string }) {
  return (
    <a
      href={`/api/events/${eventId}/ics`}
      className={
        className ??
        'inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--surface-2)] text-sm hover:bg-[var(--border)] transition'
      }
    >
      <CalendarPlus className="w-4 h-4" />
      캘린더에 추가
    </a>
  );
}
