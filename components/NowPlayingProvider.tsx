'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  isNowPlayingStale,
  NOW_PLAYING_POLL_INTERVAL_MS,
  type NowPlayingApiResponse,
  type NowPlayingSnapshot,
} from '@/lib/now-playing';

type NowPlayingContextValue = {
  snapshot: NowPlayingSnapshot | null;
  stale: boolean;
};

const NowPlayingContext = createContext<NowPlayingContextValue | null>(null);

export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<NowPlayingSnapshot | null>(null);
  const [stale, setStale] = useState(true);
  const snapshotRef = useRef<NowPlayingSnapshot | null>(null);

  const updateLocalStaleness = useCallback(() => {
    setStale(isNowPlayingStale(snapshotRef.current));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/now-playing', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        updateLocalStaleness();
        return;
      }

      const data = await response.json() as NowPlayingApiResponse;
      snapshotRef.current = data.snapshot;
      setSnapshot(data.snapshot);
      setStale(data.stale || isNowPlayingStale(data.snapshot));
    } catch {
      updateLocalStaleness();
    }
  }, [updateLocalStaleness]);

  useEffect(() => {
    let timer: number | undefined;

    const stopPolling = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };

    const startPolling = () => {
      stopPolling();
      void refresh();
      timer = window.setInterval(() => void refresh(), NOW_PLAYING_POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') startPolling();
      else stopPolling();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    handleVisibilityChange();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh]);

  const value = useMemo(() => ({ snapshot, stale }), [snapshot, stale]);
  return <NowPlayingContext.Provider value={value}>{children}</NowPlayingContext.Provider>;
}

export function useNowPlaying() {
  const context = useContext(NowPlayingContext);
  if (!context) throw new Error('useNowPlaying must be used within NowPlayingProvider.');
  return context;
}
