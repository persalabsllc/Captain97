import { NextResponse, type NextRequest } from 'next/server';
import { consumeChatRateLimit } from '@/lib/chat-store';
import {
  isSameOriginMutation,
  readJsonBody,
  requestBodyTooLarge,
  requestFingerprint,
} from '@/lib/chat-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTACT_DELIVERY_URL = 'https://formsubmit.co/ajax/kyle@captain97.com';

const CONTACT_REASONS = {
  'music-request': 'Music request',
  general: 'General question or feedback',
  underwriting: 'Underwriting & advertising',
  announcement: 'Community announcement or PSA',
  calendar: "Captain's Calendar event",
  'on-air': 'Show, contest, or on-air question',
  technical: 'Streaming or website help',
  support: 'Donate, volunteer, or support the station',
  partnership: 'Press or community partnership',
  other: 'Other',
} as const;

type ContactReason = keyof typeof CONTACT_REASONS;

type ParsedContact = {
  name: string;
  phone: string;
  email: string;
  reason: ContactReason;
  message: string;
  trapped: boolean;
};

type ParseResult =
  | { ok: true; value: ParsedContact }
  | { ok: false; message: string };

function cleanSingleLine(value: unknown, maxLength: number) {
  return (typeof value === 'string' ? value : '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanMessage(value: unknown) {
  return (typeof value === 'string' ? value : '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4_000);
}

function parseContact(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Please complete the contact form and try again.' };
  }

  const input = body as Record<string, unknown>;
  const name = cleanSingleLine(input.name, 100);
  const phone = cleanSingleLine(input.phone, 32);
  const email = cleanSingleLine(input.email, 254).toLowerCase();
  const reason = cleanSingleLine(input.reason, 40) as ContactReason;
  const message = cleanMessage(input.message);
  const trapped = cleanSingleLine(input.company, 120).length > 0;

  if (name.length < 3) {
    return { ok: false, message: 'Please enter your full name.' };
  }

  if (phone.replace(/\D/g, '').length < 7) {
    return { ok: false, message: 'Please enter a valid phone number.' };
  }

  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }

  if (!Object.hasOwn(CONTACT_REASONS, reason)) {
    return { ok: false, message: 'Please choose a reason for contacting the station.' };
  }

  if (message.length < 5) {
    return { ok: false, message: 'Please include a little more detail in your message.' };
  }

  return {
    ok: true,
    value: { name, phone, email, reason, message, trapped },
  };
}

async function contactRateLimitExceeded(request: NextRequest, email: string) {
  try {
    const [ipLimited, emailLimited] = await Promise.all([
      consumeChatRateLimit('contact-ip', requestFingerprint(request), 5, 15 * 60),
      consumeChatRateLimit('contact-email', email, 10, 60 * 60),
    ]);
    return ipLimited || emailLimited;
  } catch (error) {
    console.warn('Contact form rate limit unavailable.', error);
    return false;
  }
}

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

  if (requestBodyTooLarge(request)) {
    return errorResponse('This message is too large to send.', 413);
  }

  const parsed = parseContact(await readJsonBody(request));
  if (!parsed.ok) return errorResponse(parsed.message, 400);

  if (parsed.value.trapped) {
    return NextResponse.json({ accepted: true }, {
      status: 202,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (await contactRateLimitExceeded(request, parsed.value.email)) {
    return errorResponse('Please wait a few minutes before sending another message.', 429);
  }

  const reasonLabel = CONTACT_REASONS[parsed.value.reason];
  const delivery = new FormData();
  delivery.set('name', parsed.value.name);
  delivery.set('phone', parsed.value.phone);
  delivery.set('email', parsed.value.email);
  delivery.set('reason', reasonLabel);
  delivery.set('message', parsed.value.message);
  delivery.set('_replyto', parsed.value.email);
  delivery.set('_subject', `Captain 97 website: ${reasonLabel}`);
  delivery.set('_template', 'table');
  delivery.set('_captcha', 'false');

  try {
    const response = await fetch(CONTACT_DELIVERY_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Origin: 'https://captain97.com',
        Referer: 'https://captain97.com/contact',
      },
      body: delivery,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const result = await response.json().catch(() => null) as {
      success?: boolean | string;
    } | null;

    const delivered = result?.success === true || result?.success === 'true';
    if (!response.ok || !delivered) {
      throw new Error(`Contact delivery returned ${response.status}.`);
    }

    return NextResponse.json({ accepted: true }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to deliver Captain 97 contact message.', error);
    return errorResponse('The station inbox is temporarily unavailable. Please try again shortly.', 503);
  }
}
