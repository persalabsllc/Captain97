import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { runAutomation } from '@/lib/outreach/sender';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function GET(request: NextRequest) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ''}`);
  const actual = Buffer.from(request.headers.get('authorization') || '');
  if (!process.env.CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (process.env.VERCEL_ENV !== 'production') return NextResponse.json({ message: 'Production only.' }, { status: 403 });
  try { return NextResponse.json({ message: await runAutomation() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { console.error('Outreach scheduled run failed', error instanceof Error ? error.message : 'Unknown error'); return NextResponse.json({ message: 'Scheduled outreach could not finish.' }, { status: 503 }); }
}
