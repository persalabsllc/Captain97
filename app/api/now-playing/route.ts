import { NextResponse } from 'next/server';
import {
  isNowPlayingStale,
  type NowPlayingApiResponse,
} from '@/lib/now-playing';
import { readNowPlaying } from '@/lib/now-playing-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await readNowPlaying();
    const stale = isNowPlayingStale(snapshot);

    const response: NowPlayingApiResponse = { snapshot, stale };
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Unable to read StationPlaylist metadata.', error);
    const response: NowPlayingApiResponse = { snapshot: null, stale: true };
    return NextResponse.json(response, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
