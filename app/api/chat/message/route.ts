import { NextResponse, type NextRequest } from 'next/server';
import { parseMessageInput } from '@/lib/chat';
import { appendListenerMessage, consumeChatRateLimit } from '@/lib/chat-store';
import {
  isSameOriginMutation,
  readJsonBody,
  requestFingerprint,
} from '@/lib/chat-request';
import { readListenerChatCookie } from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return errorResponse('This message could not be verified.', 403);
  }

  const access = readListenerChatCookie(request);
  if (!access) return errorResponse('Start a conversation before sending another message.', 401);

  const parsed = parseMessageInput(await readJsonBody(request));
  if (!parsed.ok) return errorResponse(parsed.message, 400);

  try {
    const fingerprint = requestFingerprint(request);
    const [conversationLimited, ipLimited] = await Promise.all([
      consumeChatRateLimit('message-conversation', access.conversationId, 12, 60),
      consumeChatRateLimit('message-ip', fingerprint, 30, 60),
    ]);
    if (conversationLimited || ipLimited) {
      return errorResponse('Please wait a moment before sending another message.', 429);
    }

    const result = await appendListenerMessage(
      access.conversationId,
      access.accessToken,
      parsed.value.message,
    );
    if (!result) return errorResponse('This conversation is no longer available.', 404);
    if (result.closed) return errorResponse('This conversation has been closed.', 409);

    return NextResponse.json({ message: result.message }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to save listener message.', error);
    return errorResponse('Your message could not be sent. Please try again.', 503);
  }
}
