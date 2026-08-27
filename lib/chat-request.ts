import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

const MAX_CHAT_BODY_BYTES = 20_000;

export function isSameOriginMutation(request: NextRequest) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export function requestBodyTooLarge(request: NextRequest) {
  const rawLength = request.headers.get('content-length');
  if (!rawLength) return false;
  const length = Number(rawLength);
  return Number.isFinite(length) && length > MAX_CHAT_BODY_BYTES;
}

export async function readJsonBody(request: NextRequest): Promise<unknown | null> {
  if (requestBodyTooLarge(request)) return null;

  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_CHAT_BODY_BYTES) return null;
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

export function requestFingerprint(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwardedFor || request.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256')
    .update(`captain97-chat:${address}`)
    .digest('hex')
    .slice(0, 32);
}
