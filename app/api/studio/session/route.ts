import { NextResponse, type NextRequest } from 'next/server';
import { parseStudioLoginInput } from '@/lib/chat';
import { consumeChatRateLimit, resetChatRateLimit } from '@/lib/chat-store';
import {
  isSameOriginMutation,
  readJsonBody,
  requestFingerprint,
} from '@/lib/chat-request';
import {
  clearStudioSessionCookie,
  createStudioSession,
  deleteStudioSession,
  readStudioSession,
  setStudioSessionCookie,
  STUDIO_USERNAME,
  verifyStudioCredentials,
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
  try {
    const session = await readStudioSession(request);
    return session
      ? NextResponse.json(
          { authenticated: true, username: STUDIO_USERNAME },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      : errorResponse('Sign in to open the studio inbox.', 401);
  } catch (error) {
    console.error('Unable to verify studio session.', error);
    return errorResponse('The studio inbox is temporarily unavailable.', 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return errorResponse('This sign-in could not be verified.', 403);
  }

  const parsed = parseStudioLoginInput(await readJsonBody(request));
  if (!parsed.ok) return errorResponse(parsed.message, 400);

  try {
    const fingerprint = requestFingerprint(request);
    const ipLimited = await consumeChatRateLimit(
      'studio-login-ip',
      fingerprint,
      5,
      15 * 60,
    );
    if (ipLimited) {
      return errorResponse('Too many attempts. Please wait 15 minutes and try again.', 429);
    }

    if (parsed.value.username.toLowerCase() !== STUDIO_USERNAME) {
      return errorResponse('That studio username or password is incorrect.', 401);
    }

    const verified = await verifyStudioCredentials(parsed.value.username, parsed.value.password);
    if (!verified) {
      const accountLimited = await consumeChatRateLimit(
        'studio-login-account',
        STUDIO_USERNAME,
        25,
        15 * 60,
      );
      return accountLimited
        ? errorResponse('Too many attempts. Please wait 15 minutes and try again.', 429)
        : errorResponse('That studio username or password is incorrect.', 401);
    }

    await Promise.all([
      resetChatRateLimit('studio-login-ip', fingerprint),
      resetChatRateLimit('studio-login-account', STUDIO_USERNAME),
    ]);

    const token = await createStudioSession(verified.version);
    if (!token) {
      return errorResponse('The studio password changed. Please sign in again.', 409);
    }
    const response = NextResponse.json(
      { authenticated: true, username: STUDIO_USERNAME },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    setStudioSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Unable to sign in to the studio inbox.', error);
    return errorResponse('The studio inbox is temporarily unavailable.', 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return errorResponse('This request could not be verified.', 403);
  }

  try {
    await deleteStudioSession(request);
  } catch (error) {
    console.error('Unable to delete studio session.', error);
    return errorResponse('Sign out could not be completed. Please try again.', 503);
  }

  const response = NextResponse.json({ authenticated: false }, {
    headers: { 'Cache-Control': 'no-store' },
  });
  clearStudioSessionCookie(response);
  return response;
}
