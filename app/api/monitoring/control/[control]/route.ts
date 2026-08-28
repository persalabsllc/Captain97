import { NextResponse, type NextRequest } from 'next/server';
import {
  isMonitoringControlId,
  monitoringControlUrl,
} from '@/lib/monitoring-config';
import { readStudioSession } from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  Vary: 'Cookie',
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: privateHeaders });
}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ control: string }> },
) {
  try {
    const session = await readStudioSession(request);
    if (!session) return errorResponse('Sign in to open this control.', 401);

    const { control } = await context.params;
    if (!isMonitoringControlId(control)) return errorResponse('Control not found.', 404);
    const destination = monitoringControlUrl(control);
    if (!destination) return errorResponse('This control is not configured yet.', 404);

    const response = NextResponse.redirect(destination, 302);
    for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
    return response;
  } catch (error) {
    console.error('Unable to open monitoring control.', error);
    return errorResponse('This control is temporarily unavailable.', 503);
  }
}
