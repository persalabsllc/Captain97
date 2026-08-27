import { NextResponse } from 'next/server';
import type { PublicChatStatus } from '@/lib/chat';
import { readStudioAvailability } from '@/lib/chat-store';
import { getCurrentShow } from '@/lib/schedule';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [availability, current] = await Promise.all([
      readStudioAvailability(),
      Promise.resolve(getCurrentShow()),
    ]);
    const response: PublicChatStatus = {
      available: availability.available,
      hostName: current.show.host ?? null,
      showName: current.show.name,
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to read studio chat status.', error);
    return NextResponse.json(
      { message: 'Studio chat is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
