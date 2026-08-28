import type { Metadata } from 'next';
import MonitoringDashboard from '@/components/MonitoringDashboard';

export const metadata: Metadata = {
  title: 'Engineering Monitor',
  description: 'Private Captain 97 engineering and on-air monitoring.',
  robots: { index: false, follow: false, noarchive: true },
};

export default function MonitoringPage() {
  return <MonitoringDashboard />;
}
