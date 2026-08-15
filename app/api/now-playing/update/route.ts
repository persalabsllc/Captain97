import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import type { NowPlayingSnapshot, TrackMetadata } from '@/lib/now-playing';
import { hasNowPlayingStore, saveNowPlaying } from '@/lib/now-playing-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_TEXT_LENGTH = 240;

function cleanText(value: string | null) {
  if (!value) return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function cleanArtworkUrl(value: string | null) {
  const candidate = cleanText(value);
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function cleanDuration(value: string | null) {
  if (!value) return undefined;
  const duration = Number.parseInt(value, 10);
  return Number.isFinite(duration) && duration > 0 && duration < 86_400
    ? duration
    : undefined;
}

function trackParameter(prefix: string, field: string) {
  return prefix ? `${prefix}${field[0].toUpperCase()}${field.slice(1)}` : field;
}

function readTrack(params: URLSearchParams, prefix = ''): TrackMetadata | null {
  const artist = cleanText(params.get(trackParameter(prefix, 'artist')));
  const title = cleanText(params.get(trackParameter(prefix, 'title')));
  if (!artist && !title) return null;

  const album = cleanText(params.get(trackParameter(prefix, 'album'))) || undefined;
  const category = cleanText(params.get(trackParameter(prefix, 'category'))) || undefined;
  const durationSeconds = cleanDuration(params.get(trackParameter(prefix, 'duration')));
  const artworkUrl = cleanArtworkUrl(params.get(trackParameter(prefix, 'artwork')));

  return {
    artist,
    title,
    ...(album ? { album } : {}),
    ...(category ? { category } : {}),
    ...(durationSeconds ? { durationSeconds } : {}),
    ...(artworkUrl ? { artworkUrl } : {}),
  };
}

function isAuthorized(provided: string | null) {
  const expected = process.env.STATIONPLAYLIST_UPDATE_TOKEN;
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (!isAuthorized(params.get('token'))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!hasNowPlayingStore()) {
    return NextResponse.json({ ok: false, error: 'Metadata storage is not configured.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const current = readTrack(params);
  if (!current) {
    return NextResponse.json({ ok: false, error: 'Artist or title is required.' }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const upNext = [readTrack(params, 'next'), readTrack(params, 'later')]
    .filter((track): track is TrackMetadata => track !== null);

  const snapshot: NowPlayingSnapshot = {
    version: 1,
    source: 'stationplaylist',
    current,
    upNext,
    updatedAt: new Date().toISOString(),
  };

  try {
    await saveNowPlaying(snapshot);
  } catch (error) {
    console.error('Unable to save StationPlaylist metadata.', error);
    return NextResponse.json({ ok: false, error: 'Unable to save metadata.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json({ ok: true, updatedAt: snapshot.updatedAt }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
