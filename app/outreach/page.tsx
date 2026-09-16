import type { Metadata } from 'next';
import OutreachCRM from '@/components/outreach/OutreachCRM';
export const metadata: Metadata = { title: 'Outreach CRM', description: 'Private Captain 97.1 business outreach.', robots: { index: false, follow: false, noarchive: true } };
export default function OutreachPage() { return <OutreachCRM />; }
