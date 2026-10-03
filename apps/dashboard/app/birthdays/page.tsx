import type { Metadata } from 'next';
import BirthdaysPageClient from './BirthdaysPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Upcoming Birthdays | Sabha Analytics',
};

export default function BirthdaysPage() {
  return <BirthdaysPageClient />;
}
