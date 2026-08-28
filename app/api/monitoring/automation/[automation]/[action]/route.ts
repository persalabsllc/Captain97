import { NextResponse, type NextRequest } from 'next/server';
import { consumeChatRateLimit, resetChatRateLimit } from '@/lib/chat-store';
import { isSameOriginMutation } from '@/lib/chat-request';
import {
  isMonitoringAutomationAction,
  isMonitoringAutomationId,
  monitoringAutomationCredential,
  monitoringAutomationUrl,
} from '@/lib/monitoring-config';
import type { MonitoringAutomationId } from '@/lib/monitoring';
import { readStudioSession } from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  Vary: 'Cookie',
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: privateHeaders });
}

async function readRoute(
  context: { params: Promise<{ automation: string; action: string }> },
) {
  const { automation, action } = await context.params;
  if (!isMonitoringAutomationId(automation) || !isMonitoringAutomationAction(action)) {
    return null;
  }
  return { automation, action };
}

async function readBoundedText(response: Response, maximumBytes: number) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error('Upstream response is unexpectedly large.');
  }
  if (!response.body) throw new Error('Upstream response did not include a body.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > maximumBytes) {
      await reader.cancel();
      throw new Error('Upstream response is unexpectedly large.');
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

async function latestInformationUrl(
  automation: MonitoringAutomationId,
  archiveUrl: string,
) {
  const archive = new URL(archiveUrl);
  const archivePath = archive.pathname.endsWith('/') ? archive.pathname : `${archive.pathname}/`;
  archive.pathname = archivePath;
  const response = await fetch(archive, {
    cache: 'no-store',
    headers: { Accept: 'text/html' },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Archive returned ${response.status}.`);
  const html = await readBoundedText(response, 2_000_000);

  const prefix = automation === 'news' ? 'news' : 'weather';
  const filenamePattern = new RegExp(`^${prefix}_\\d{4}-\\d{2}-\\d{2}_\\d{6}\\.txt$`);
  const filenames = Array.from(html.matchAll(/href=["']([^"']+)["']/gi), (match) => match[1])
    .filter((href): href is string => Boolean(href))
    .map((href) => {
      try {
        const candidate = new URL(href, archive);
        const filename = decodeURIComponent(candidate.pathname.slice(archivePath.length));
        if (
          candidate.origin !== archive.origin
          || !candidate.pathname.startsWith(archivePath)
          || filename.includes('/')
          || candidate.search
          || candidate.hash
          || !filenamePattern.test(filename)
        ) return null;
        return filename;
      } catch {
        return null;
      }
    })
    .filter((filename): filename is string => Boolean(filename))
    .sort();

  const latest = filenames.at(-1);
  return latest ? new URL(encodeURIComponent(latest), archive) : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ automation: string; action: string }> },
) {
  try {
    const session = await readStudioSession(request);
    if (!session) return errorResponse('Sign in to open this automation control.', 401);

    const route = await readRoute(context);
    if (!route || route.action === 'generate') return errorResponse('Control not found.', 404);
    const destination = monitoringAutomationUrl(route.automation, route.action);
    if (!destination) return errorResponse('This automation control is not configured.', 404);

    const resolved = route.action === 'latest'
      ? await latestInformationUrl(route.automation, destination)
      : new URL(destination);
    if (!resolved) return errorResponse('No generated information file was found.', 404);

    const response = NextResponse.redirect(resolved, 302);
    for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
    return response;
  } catch (error) {
    console.error('Unable to open monitoring automation content.', error);
    return errorResponse('This automation content is temporarily unavailable.', 503);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ automation: string; action: string }> },
) {
  if (!request.headers.get('origin') || !isSameOriginMutation(request)) {
    return errorResponse('This generation request could not be verified.', 403);
  }

  let consumedCooldown: MonitoringAutomationId | null = null;
  try {
    const session = await readStudioSession(request);
    if (!session) return errorResponse('Sign in to start a generation.', 401);

    const route = await readRoute(context);
    if (!route || route.action !== 'generate') return errorResponse('Control not found.', 404);
    const destination = monitoringAutomationUrl(route.automation, 'generate');
    const credential = monitoringAutomationCredential(route.automation);
    if (!destination || !credential) {
      return errorResponse('This generation control is awaiting a protected upstream endpoint.', 404);
    }

    const limited = await consumeChatRateLimit(
      'monitoring-ai-generation',
      route.automation,
      1,
      5 * 60,
    );
    if (limited) {
      return errorResponse('A generation was already started recently. Wait five minutes before trying again.', 429);
    }
    consumedCooldown = route.automation;

    const upstream = await fetch(destination, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${credential}`,
      },
      redirect: 'error',
      signal: AbortSignal.timeout(50_000),
    });
    if (!upstream.ok) throw new Error(`Generator returned ${upstream.status}.`);
    const upstreamBody = await readBoundedText(upstream, 64_000);
    let confirmation: unknown;
    try {
      confirmation = JSON.parse(upstreamBody);
    } catch {
      throw new Error('Generator did not return a JSON confirmation.');
    }
    if (
      !confirmation
      || typeof confirmation !== 'object'
      || Array.isArray(confirmation)
      || !('ok' in confirmation)
      || confirmation.ok !== true
    ) {
      throw new Error('Generator did not confirm success.');
    }
    consumedCooldown = null;

    const label = route.automation === 'news' ? 'News' : 'Weather';
    return NextResponse.json({
      ok: true,
      message: `${label} generation completed. It created a new file but did not replace the item currently scheduled on air.`,
    }, { headers: privateHeaders });
  } catch (error) {
    if (consumedCooldown) {
      await resetChatRateLimit('monitoring-ai-generation', consumedCooldown).catch((resetError) => {
        console.error('Unable to release failed monitoring generation cooldown.', resetError);
      });
    }
    console.error('Unable to start monitoring automation generation.', error);
    return errorResponse('The generator did not confirm completion. Check the latest script before trying again.', 503);
  }
}
