import { NextResponse, type NextRequest } from 'next/server';
import {
  readStudioAvailability,
  renewStudioAvailability,
  setStudioAvailability,
} from '@/lib/chat-store';
import { isSameOriginMutation, readJsonBody } from '@/lib/chat-request';
import { readStudioSession } from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ message: 'This request could not be verified.' }, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    if (!await readStudioSession(request)) {
      return NextResponse.json({ message: 'Unauthorized' }, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const body = await readJsonBody(request);
    const available = body && typeof body === 'object'
      ? (body as Record<string, unknown>).available
      : null;
    if (typeof available !== 'boolean') {
      return NextResponse.json({ message: 'Choose Available or Taking messages.' }, {
        status: 400,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const heartbeat = (body as Record<string, unknown>).heartbeat === true;
    const leaseId = (body as Record<string, unknown>).leaseId;
    if (heartbeat) {
      if (!available || typeof leaseId !== 'string' || !/^[a-zA-Z0-9_-]{32}$/.test(leaseId)) {
        return NextResponse.json({ message: 'The availability lease is invalid.' }, {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      const renewed = await renewStudioAvailability(leaseId);
      if (!renewed) {
        const availability = await readStudioAvailability();
        return NextResponse.json({
          message: 'The studio availability status changed in another tab.',
          availability,
        }, {
          status: 409,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      return NextResponse.json({ availability: renewed }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const availability = await setStudioAvailability(available);
    return NextResponse.json({ availability }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to update studio availability.', error);
    return NextResponse.json({ message: 'The studio status could not be updated.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
