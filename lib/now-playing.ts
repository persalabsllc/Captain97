export type TrackMetadata = {
  readonly artist: string;
  readonly title: string;
  readonly album?: string;
  readonly category?: string;
  readonly durationSeconds?: number;
  readonly artworkUrl?: string;
};

export type NowPlayingSnapshot = {
  readonly version: 1;
  readonly source: 'stationplaylist';
  readonly current: TrackMetadata;
  readonly upNext: readonly TrackMetadata[];
  readonly updatedAt: string;
};

export type NowPlayingApiResponse = {
  readonly snapshot: NowPlayingSnapshot | null;
  readonly stale: boolean;
};

export const NOW_PLAYING_POLL_INTERVAL_MS = 15_000;

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1_000;
const MINIMUM_STALE_AFTER_MS = 6 * 60 * 1_000;
const MAXIMUM_STALE_AFTER_MS = 30 * 60 * 1_000;
const TRACK_END_GRACE_MS = 3 * 60 * 1_000;

export function isNowPlayingStale(
  snapshot: NowPlayingSnapshot | null,
  now = Date.now(),
) {
  if (!snapshot) return true;

  const updatedAt = Date.parse(snapshot.updatedAt);
  if (!Number.isFinite(updatedAt)) return true;

  const durationMs = snapshot.current.durationSeconds
    ? snapshot.current.durationSeconds * 1_000
    : null;
  const staleAfter = durationMs === null
    ? DEFAULT_STALE_AFTER_MS
    : Math.min(
      MAXIMUM_STALE_AFTER_MS,
      Math.max(MINIMUM_STALE_AFTER_MS, durationMs + TRACK_END_GRACE_MS),
    );

  return now - updatedAt > staleAfter;
}
