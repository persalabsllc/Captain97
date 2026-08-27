import { NextResponse, type NextRequest } from 'next/server';
import { parsePasswordChangeInput } from '@/lib/chat';
import { consumeChatRateLimit } from '@/lib/chat-store';
import {
  isSameOriginMutation,
  readJsonBody,
  requestFingerprint,
} from '@/lib/chat-request';
import {
  changeStudioPassword,
  readStudioSession,
  setStudioSessionCookie,
} from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return errorResponse('This request could not be verified.', 403);
  }

  try {
    if (!await readStudioSession(request)) return errorResponse('Unauthorized', 401);
    const [ipLimited, accountLimited] = await Promise.all([
      consumeChatRateLimit('studio-password-ip', requestFingerprint(request), 5, 15 * 60),
      consumeChatRateLimit('studio-password-account', 'studio', 10, 15 * 60),
    ]);
    if (ipLimited || accountLimited) {
      return errorResponse('Too many password attempts. Please wait 15 minutes and try again.', 429);
    }
    const parsed = parsePasswordChangeInput(await readJsonBody(request));
    if (!parsed.ok) return errorResponse(parsed.message, 400);

    const token = await changeStudioPassword(
      parsed.value.currentPassword,
      parsed.value.newPassword,
    );
    if (!token) return errorResponse('The current password is incorrect.', 401);

    const response = NextResponse.json(
      { ok: true, message: 'Studio password updated.' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    setStudioSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Unable to change studio password.', error);
    return errorResponse('The studio password could not be changed.', 503);
  }
}
