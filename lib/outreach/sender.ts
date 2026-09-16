import { siteConfig } from '../site';
import { changeState, readState, withLock } from './store';
import { countedToday, eligible, sendingWindow, type Email, type Settings } from './types';
import { discover } from './discovery';
export function footer(token: string) {
  return `\n\n—\nCaptain 97.1 • Business outreach\n${siteConfig.address.lines.join(', ')}\nPrefer no further outreach? Unsubscribe: ${siteConfig.url}/api/outreach/unsubscribe?token=${token}`;
}
async function transmit(email: Email, settings: Settings, token: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `captain97-outreach-${email.id}` },
    body: JSON.stringify({ from: settings.from, to: [email.to], reply_to: settings.replyTo, subject: email.subject,
      text: email.body + footer(token), headers: { 'List-Unsubscribe': `<${siteConfig.url}/api/outreach/unsubscribe?token=${token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }),
    signal: AbortSignal.timeout(15000), cache: 'no-store',
  });
  const data = await response.json().catch(() => null) as { id?: string; message?: string } | null;
  if (!response.ok) return { rejected: response.status >= 400 && response.status < 500, error: `Email provider: ${response.status}. ${data?.message || 'Check the sending connection.'}` };
  if (!data?.id) return { rejected: false, error: 'Provider response did not include a message ID. Check Resend before trying again.' };
  return { id: data.id };
}
export async function sendNext(id?: string) {
  if (!process.env.RESEND_API_KEY) throw new Error('Email sending is not connected.');
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') throw new Error('Sending is disabled on preview deployments.');
  return withLock('sending', async () => {
    const reservation = await changeState(s => {
      // A terminated request may have reached the provider. Never resend it automatically.
      for (const e of s.emails) if (e.status === 'sending' && e.attemptedAt && Date.now() - Date.parse(e.attemptedAt) > 180000) { e.status = 'uncertain'; e.error = 'Delivery could not be confirmed. Check Resend; this message will not be retried automatically.'; }
      if (!id && (!s.settings.enabled || !sendingWindow())) return null;
      if (countedToday(s) >= s.settings.dailyLimit) throw new Error('The daily sending limit has been reached.');
      const email = id ? s.emails.find(e => e.id === id) : [...s.emails].reverse().find(e => e.status === 'queued' && Date.parse(e.scheduledAt) <= Date.now());
      if (!email) return null;
      if (!['draft', 'queued'].includes(email.status)) throw new Error('This email has already been processed.');
      const p = s.prospects.find(p => p.id === email.prospectId);
      if (!p || p.email !== email.to || !eligible(p, s)) { email.status = 'cancelled'; return { cancelled: true as const }; }
      if (!id && ['replied', 'meeting', 'proposal'].includes(p.stage)) { email.status = 'cancelled'; return { cancelled: true as const }; }
      if (!email.subject.trim() || !email.body.trim()) throw new Error('Add a subject and email message.');
      email.status = 'sending'; email.attemptedAt = new Date().toISOString();
      return { cancelled: false as const, email: structuredClone(email), settings: structuredClone(s.settings), token: p.unsubscribeToken };
    });
    if (!reservation) return 'No emails are due to send.';
    if (reservation.cancelled) return 'Email cancelled because the contact is no longer eligible.';
    // Recheck opt-outs and pause after reserving and immediately before the external call.
    const current = await readState();
    const prospect = current.prospects.find(p => p.id === reservation.email.prospectId);
    if (!prospect || prospect.email !== reservation.email.to || !eligible(prospect, current) || (!id && !current.settings.enabled)) {
      await changeState(s => { const e = s.emails.find(e => e.id === reservation.email.id); if (e) e.status = 'cancelled'; });
      return 'Sending stopped.';
    }
    let result: Awaited<ReturnType<typeof transmit>>;
    try { result = await transmit(reservation.email, reservation.settings, reservation.token); }
    catch { result = { rejected: false, error: 'Connection interrupted. Check Resend before creating another message; this email will not be retried automatically.' }; }
    await changeState(s => {
      const e = s.emails.find(e => e.id === reservation.email.id); if (!e) return;
      if (result.id) {
        e.status = 'sent'; e.providerId = result.id; e.sentAt = new Date().toISOString();
        const p = s.prospects.find(p => p.id === e.prospectId);
        if (p && !['unsubscribed', 'closed', 'won'].includes(p.stage)) { if (p.stage === 'new') p.stage = 'contacted'; p.updatedAt = e.sentAt; p.nextFollowUp ||= new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10); }
      } else { e.status = result.rejected ? 'failed' : 'uncertain'; e.error = result.error; }
      s.lastResult = result.id ? `Email sent to ${reservation.email.to}.` : result.error;
    });
    if (!result.id) throw new Error(result.error);
    return `Email sent to ${reservation.email.to}.`;
  });
}
export async function runAutomation() {
  const state = await readState();
  if (!state.settings.enabled || !sendingWindow()) return 'Automation is paused or outside weekday sending hours.';
  await changeState(s => { s.lastRun = new Date().toISOString(); });
  if (state.settings.autoDiscover && (!state.lastDiscovery || Date.now() - Date.parse(state.lastDiscovery) > 60 * 60 * 1000)) {
    try { await discover(state.settings.category); }
    catch (error) { await changeState(s => { s.lastResult = error instanceof Error ? error.message : 'Prospect research could not finish.'; }); }
  }
  return sendNext();
}
