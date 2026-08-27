'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { NowPlayingProvider } from './NowPlayingProvider';
import { AudioProvider, PlayerDock } from './StationPlayer';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

export default function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname === '/studio' || pathname.startsWith('/studio/');

  if (isStudio) {
    return <div className="studio-shell">{children}</div>;
  }

  return (
    <AudioProvider>
      <NowPlayingProvider>
        <SiteHeader />
        {children}
        <SiteFooter />
        <PlayerDock />
      </NowPlayingProvider>
    </AudioProvider>
  );
}
