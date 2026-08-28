import { NextResponse, type NextRequest } from 'next/server';
import {
  isMonitoringTelemetryStale,
  monitoringAudioSources,
  monitoringControls,
} from '@/lib/monitoring-config';
import { readMonitoringTelemetry } from '@/lib/monitoring-store';
import type { MonitoringDashboardResponse } from '@/lib/monitoring';
import { isNowPlayingStale } from '@/lib/now-playing';
import { readNowPlaying } from '@/lib/now-playing-store';
import { readStudioSession } from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: privateHeaders });
}
export async function GET(request: NextRequest) {
  try {
    const session = await readStudioSession(request);
    if (!session) return errorResponse('Sign in to open engineering monitoring.', 401);

    const [telemetry, snapshot] = await Promise.all([
      readMonitoringTelemetry(),
      readNowPlaying().catch((error) => {
        console.error('Unable to read monitoring now-playing metadata.', error);
        return null;
      }),
    ]);
    const telemetryStale = isMonitoringTelemetryStale(telemetry);
    const nowPlayingStale = isNowPlayingStale(snapshot);
    const response: MonitoringDashboardResponse = {
      generatedAt: new Date().toISOString(),
      telemetryReceivedAt: telemetry?.receivedAt ?? null,
      telemetryStale,
      audioSources: monitoringAudioSources(telemetry, telemetryStale),
      transmitter: telemetry?.transmitter ?? null,
      listenerCount: telemetry?.listeners?.current ?? null,
      nowPlaying: {
        current: snapshot?.current ?? null,
        upNext: snapshot?.upNext ?? [],
        updatedAt: snapshot?.updatedAt ?? null,
        stale: nowPlayingStale,
      },
      controls: monitoringControls(),
    };

    return NextResponse.json(response, { headers: privateHeaders });
  } catch (error) {
    console.error('Unable to load engineering monitoring.', error);
    return errorResponse('Engineering monitoring is temporarily unavailable.', 503);
  }
}
