import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Month view is the landing screen.
export default function HomePage() {
  redirect('/calendar');
}
