import type { Metadata } from 'next';
import StudioPortal from '@/components/StudioPortal';

export const metadata: Metadata = {
  title: 'DJ Inbox',
  description: 'Private Captain 97 studio inbox.',
  robots: { index: false, follow: false, noarchive: true },
};

export default function StudioPage() {
  return <StudioPortal />;
}
