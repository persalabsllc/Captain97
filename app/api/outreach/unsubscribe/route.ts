import { type NextRequest, NextResponse } from 'next/server';
import { unsubscribe } from '@/lib/outreach/store';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function page(message: string, token = '', status = 200) {
  return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Captain 97.1 email preferences</title><body style="font:18px system-ui;background:#0c1128;color:white;padding:40px;line-height:1.7"><main style="max-width:550px;margin:8vh auto"><p>CAPTAIN 97.1</p><h1>Email preferences</h1><p>${message}</p>${token ? `<form method="post"><button style="padding:14px 24px;font:inherit;background:#ffd84d;border:0;border-radius:8px">Unsubscribe from outreach</button></form>` : ''}</main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } });
}
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  if (!/^[\w-]{43}$/.test(token)) return page('This email preferences link is invalid.', '', 400);
  return page('Use the button below to stop future business outreach emails from Captain 97.1. No sign-in is needed.', token);
}
export async function POST(request: NextRequest) {
  try { const ok = await unsubscribe(request.nextUrl.searchParams.get('token') || ''); return page(ok ? 'You have been unsubscribed. We will not send further business outreach emails to this address.' : 'This email preferences link is invalid.', '', ok ? 200 : 400); }
  catch { return page('We could not save your preference. Please try again or reply to the email asking to unsubscribe.', '', 503); }
}
