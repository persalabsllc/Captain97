import { NextResponse, type NextRequest } from 'next/server';
import { parseConversationCreateInput } from '@/lib/chat';
import {
  consumeChatRateLimit,
  createChatConversation,
  readListenerConversation,
} from '@/lib/chat-store';
import {
  isSameOriginMutation,
  readJsonBody,
  requestFingerprint,
} from '@/lib/chat-request';
import { getCurrentShow } from '@/lib/schedule';
import {
  clearListenerChatCookie,
  readListenerChatCookie,
  setListenerChatCookie,
} from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  const access = readListenerChatCookie(request);
  if (!access) return errorResponse('No active conversation.', 404);

  try {
    const conversation = await readListenerConversation(
      access.conversationId,
      access.accessToken,
    );

    if (!conversation) {
      const response = errorResponse('This conversation is no longer available.', 404);
      clearListenerChatCookie(response);
      return response;
    }

    return NextResponse.json({ conversation }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to read listener conversation.', error);
    return errorResponse('Studio chat is temporarily unavailable.', 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return errorResponse('This message could not be verified.', 403);
  }

  const body = await readJsonBody(request);
  const parsed = parseConversationCreateInput(body);
  if (!parsed.ok) return errorResponse(parsed.message, 400);

  if (parsed.value.trapped) {
    return NextResponse.json({ accepted: true }, {
      status: 202,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const fingerprint = requestFingerprint(request);
    const [ipLimited, emailLimited] = await Promise.all([
      consumeChatRateLimit('create-ip', fingerprint, 3, 10 * 60),
      consumeChatRateLimit('create-email', parsed.value.email, 5, 60 * 60),
    ]);
    if (ipLimited || emailLimited) {
      return errorResponse('Please wait a few minutes before starting another chat.', 429);
    }

    const current = getCurrentShow();
    const created = await createChatConversation({
      name: parsed.value.name,
      email: parsed.value.email,
      message: parsed.value.message,
      ...(current.show.host ? { hostAtStart: current.show.host } : {}),
    });
    const response = NextResponse.json(
      { conversation: created.conversation },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
    setListenerChatCookie(response, created.conversation.id, created.accessToken);
    return response;
  } catch (error) {
    console.error('Unable to create listener conversation.', error);
    return errorResponse('Studio chat is temporarily unavailable. Please try again shortly.', 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return errorResponse('This request could not be verified.', 403);
  }

  const response = NextResponse.json({ ok: true }, {
    headers: { 'Cache-Control': 'no-store' },
  });
  clearListenerChatCookie(response);
  return response;
}
