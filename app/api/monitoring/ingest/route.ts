import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { consumeChatRateLimit } from '@/lib/chat-store';
import { readJsonBody } from '@/lib/chat-request';
import { parseMonitoringTelemetry } from '@/lib/monitoring';
import {
  MonitoringTelemetryReplayError,
  saveMonitoringTelemetry,
} from '@/lib/monitoring-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: noStoreHeaders });
}

function tokenMatches(request: NextRequest) {
  const expected = process.env.MONITORING_INGEST_TOKEN;
  if (!expected || expected.length < 32) return false;
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const provided = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: NextRequest) {
  if (!process.env.MONITORING_INGEST_TOKEN || process.env.MONITORING_INGEST_TOKEN.length < 32) {
    return errorResponse('Monitoring ingest is not configured.', 503);
  }
  if (!tokenMatches(request)) return errorResponse('Unauthorized', 401);

  try {
    const limited = await consumeChatRateLimit('monitoring-ingest', 'station-agent', 120, 60);
    if (limited) return errorResponse('Too many telemetry updates.', 429);

    const parsed = parseMonitoringTelemetry(await readJsonBody(request));
    if (!parsed.ok) return errorResponse(parsed.message, 400);

    await saveMonitoringTelemetry(parsed.value);
    return NextResponse.json({
      ok: true,
      receivedAt: parsed.value.receivedAt,
    }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof MonitoringTelemetryReplayError) {
      return errorResponse('Telemetry is stale or has already been received.', 409);
    }
    console.error('Unable to ingest monitoring telemetry.', error);
    return errorResponse('Telemetry could not be stored.', 503);
  }
}
