import { Redis } from '@upstash/redis';
import type { NowPlayingSnapshot } from './now-playing';

const NOW_PLAYING_KEY = 'captain97:now-playing:v1';

let redis: Redis | null | undefined;
let localDevelopmentSnapshot: NowPlayingSnapshot | null = null;

function getRedis() {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export function hasNowPlayingStore() {
  return getRedis() !== null || process.env.NODE_ENV === 'development';
}

export async function saveNowPlaying(snapshot: NowPlayingSnapshot) {
  const client = getRedis();
  if (client) {
    await client.set(NOW_PLAYING_KEY, snapshot);
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    localDevelopmentSnapshot = snapshot;
    return;
  }

  throw new Error('Now-playing storage is not configured.');
}

export async function readNowPlaying() {
  const client = getRedis();
  if (client) return client.get<NowPlayingSnapshot>(NOW_PLAYING_KEY);
  if (process.env.NODE_ENV === 'development') return localDevelopmentSnapshot;
  return null;
}

