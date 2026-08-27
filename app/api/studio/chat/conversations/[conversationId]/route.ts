import { NextResponse, type NextRequest } from 'next/server';
import { parseStudioReplyInput, type ChatConversationStatus } from '@/lib/chat';
import {
  appendStudioMessage,
  consumeChatRateLimit,
  markConversationRead,
  readStudioConversation,
  setConversationStatus,
} from '@/lib/chat-store';
import { isSameOriginMutation, readJsonBody } from '@/lib/chat-request';
import { readStudioSession } from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function authorized(request: NextRequest) {
  return Boolean(await readStudioSession(request));
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!await authorized(request)) return errorResponse('Unauthorized', 401);
    const { conversationId } = await context.params;
    const revisionValue = request.nextUrl.searchParams.get('revision');
    const knownRevision = revisionValue && /^\d+$/.test(revisionValue)
      ? Number(revisionValue)
      : undefined;
    const result = await readStudioConversation(conversationId, knownRevision);
    if (!result) return errorResponse('Conversation not found.', 404);
    return result.unchanged
      ? NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
      : NextResponse.json({ conversation: result.conversation }, {
        headers: { 'Cache-Control': 'no-store' },
      });
  } catch (error) {
    console.error('Unable to read studio conversation.', error);
    return errorResponse('The conversation is temporarily unavailable.', 503);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginMutation(request)) return errorResponse('This message could not be verified.', 403);

  try {
    if (!await authorized(request)) return errorResponse('Unauthorized', 401);
    const parsed = parseStudioReplyInput(await readJsonBody(request));
    if (!parsed.ok) return errorResponse(parsed.message, 400);

    const { conversationId } = await context.params;
    const limited = await consumeChatRateLimit('studio-reply', conversationId, 60, 60);
    if (limited) return errorResponse('Please wait a moment before sending another reply.', 429);

    const result = await appendStudioMessage(
      conversationId,
      parsed.value.message,
      parsed.value.displayName,
    );
    if (!result) return errorResponse('Conversation not found.', 404);
    if (result.closed) return errorResponse('Reopen this conversation before replying.', 409);

    return NextResponse.json({ message: result.message }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to save studio reply.', error);
    return errorResponse('Your reply could not be sent. Please try again.', 503);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginMutation(request)) return errorResponse('This request could not be verified.', 403);

  try {
    if (!await authorized(request)) return errorResponse('Unauthorized', 401);
    const body = await readJsonBody(request);
    const action = body && typeof body === 'object'
      ? (body as Record<string, unknown>).action
      : null;
    const { conversationId } = await context.params;

    if (action === 'read') {
      const revision = Number((body as Record<string, unknown>).revision);
      if (!Number.isSafeInteger(revision) || revision < 1) {
        return errorResponse('Refresh the conversation before marking it read.', 400);
      }
      const result = await markConversationRead(conversationId, revision);
      if (result.status === 'missing') return errorResponse('Conversation not found.', 404);
      if (result.status === 'changed') {
        return errorResponse('A new listener message arrived. Review it before marking the chat read.', 409);
      }
      return NextResponse.json({ ok: true, revision: result.revision }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (action === 'open' || action === 'closed') {
      const found = await setConversationStatus(
        conversationId,
        action as ChatConversationStatus,
      );
      return found
        ? NextResponse.json({ status: action }, { headers: { 'Cache-Control': 'no-store' } })
        : errorResponse('Conversation not found.', 404);
    }

    return errorResponse('Choose a valid conversation action.', 400);
  } catch (error) {
    console.error('Unable to update studio conversation.', error);
    return errorResponse('The conversation could not be updated.', 503);
  }
}
