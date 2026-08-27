import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { consumeChatRateLimit } from '@/lib/chat-store';
import {
  isSameOriginMutation,
  readJsonBody,
  requestBodyTooLarge,
  requestFingerprint,
} from '@/lib/chat-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTACT_RECIPIENT = 'kyle@captain97.com';
const DEFAULT_CONTACT_SENDER = 'Captain 97 Website <website@captain97.com>';

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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character);
}

function contactEmailHtml(contact: ParsedContact, reasonLabel: string) {
  const rows = [
    ['Reason', reasonLabel],
    ['Name', contact.name],
    ['Phone', contact.phone],
    ['Email', contact.email],
  ].map(([label, value]) => `
    <tr>
      <th style="padding:10px 14px;text-align:left;vertical-align:top;color:#0b3744;background:#eaf7f6;border-bottom:1px solid #d3e4e3;">${escapeHtml(label)}</th>
      <td style="padding:10px 14px;color:#182b35;border-bottom:1px solid #d3e4e3;">${escapeHtml(value)}</td>
    </tr>`).join('');

  return `<!doctype html>
  <html lang="en">
    <body style="margin:0;padding:24px;background:#f4f1e8;font-family:Arial,sans-serif;color:#182b35;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d3e4e3;border-radius:14px;overflow:hidden;">
        <div style="padding:22px 24px;background:#0b3744;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#72d7cf;">Captain 97.1</div>
          <h1 style="margin:6px 0 0;font-size:23px;line-height:1.25;">New website message</h1>
        </div>
        <div style="padding:22px 24px;">
          <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #d3e4e3;border-radius:8px;overflow:hidden;">${rows}</table>
          <h2 style="margin:24px 0 8px;font-size:16px;color:#0b3744;">Message</h2>
          <div style="padding:16px;background:#f8faf9;border-left:4px solid #f2c94c;border-radius:4px;white-space:pre-wrap;line-height:1.6;">${escapeHtml(contact.message)}</div>
        </div>
      </div>
    </body>
  </html>`;
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured for the Captain 97 contact form.');
    return errorResponse('The station inbox is temporarily unavailable. Please try again shortly.', 503);
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.CONTACT_FROM_EMAIL || DEFAULT_CONTACT_SENDER,
      to: CONTACT_RECIPIENT,
      replyTo: parsed.value.email,
      subject: `Captain 97 website: ${reasonLabel}`,
      text: [
        `Reason: ${reasonLabel}`,
        `Name: ${parsed.value.name}`,
        `Phone: ${parsed.value.phone}`,
        `Email: ${parsed.value.email}`,
        '',
        parsed.value.message,
      ].join('\n'),
      html: contactEmailHtml(parsed.value, reasonLabel),
    });

    if (error) {
      throw new Error(`Resend rejected contact delivery: ${error.message}`);
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
