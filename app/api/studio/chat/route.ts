import { NextResponse, type NextRequest } from 'next/server';
import {
  listStudioConversations,
  readStudioAvailability,
  readStudioInboxVersion,
} from '@/lib/chat-store';
import { readStudioSession } from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (!await readStudioSession(request)) {
      return NextResponse.json({ message: 'Unauthorized' }, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const knownVersionValue = request.nextUrl.searchParams.get('version');
    const knownVersion = knownVersionValue && /^\d+$/.test(knownVersionValue)
      ? Number(knownVersionValue)
      : null;
    const [version, availability] = await Promise.all([
      readStudioInboxVersion(),
      readStudioAvailability(),
    ]);

    if (knownVersion === version) {
      return NextResponse.json({ unchanged: true, version, availability }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const conversations = await listStudioConversations();
    return NextResponse.json({ conversations, version, availability }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to read studio inbox.', error);
    return NextResponse.json({ message: 'The studio inbox is temporarily unavailable.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
