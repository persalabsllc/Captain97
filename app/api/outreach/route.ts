import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { readStudioSession } from '@/lib/studio-auth';
import { isSameOriginMutation, readJsonBody } from '@/lib/chat-request';
import { changeState, newToken, readState } from '@/lib/outreach/store';
import { countedToday, discoveryCategories, discoverySources, eligible, emailValid, offers, renderTemplate, stages, type DiscoverySource, type Offer, type Stage, type Template } from '@/lib/outreach/types';
import { publicUrl } from '@/lib/outreach/public-web';
import { discover, researchWebsite } from '@/lib/outreach/discovery';
import { sendNext } from '@/lib/outreach/sender';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function text(x: unknown, max = 200) { return typeof x === 'string' ? x.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : ''; }
function line(x: unknown, max = 200) { return text(x, max).replace(/[\r\n]/g, ' '); }
function url(x: unknown) { const value = text(x, 1000); return value ? publicUrl(value).href : ''; }
function discoverySource(x: unknown): DiscoverySource { if (x == null || x === '') return 'all'; if (!Object.hasOwn(discoverySources, String(x))) throw new Error('Choose a listed discovery source.'); return x as DiscoverySource; }
function offer(x: unknown): Offer { return Object.hasOwn(offers, String(x)) ? x as Offer : 'radio'; }
function date(x: unknown) { const value = text(x, 40); if (!value) return ''; if (!Number.isFinite(Date.parse(value))) throw new Error('Choose a valid date.'); return new Date(value).toISOString(); }
export async function GET(request: NextRequest) {
  try {
    if (!await readStudioSession(request)) return json({ message: 'Sign in to the outreach CRM.' }, 401);
    const state = await readState();
    return json({ ...state, connections: { email: Boolean(process.env.RESEND_API_KEY), scheduler: Boolean(process.env.CRON_SECRET) }, todayCount: countedToday(state) });
  } catch { return json({ message: 'The outreach CRM is temporarily unavailable. Please try again.' }, 503); }
}
export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return json({ message: 'This request could not be verified.' }, 403);
  try {
    if (!await readStudioSession(request)) return json({ message: 'Sign in to the outreach CRM.' }, 401);
    const raw = await readJsonBody(request);
    if (!raw || typeof raw !== 'object') return json({ message: 'Invalid request.' }, 400);
    const input = raw as Record<string, unknown>; const action = input.action;
    if (action === 'discover') return json({ message: await discover(line(input.category, 80) || 'restaurants', discoverySource(input.source)) });
    if (action === 'send') return json({ message: await sendNext(line(input.id, 64) || undefined) });
    if (action === 'research') {
      const state = await readState(); const prospect = state.prospects.find(p => p.id === input.id);
      if (!prospect?.website) throw new Error('Add a business website first.');
      const result = await researchWebsite(prospect.website);
      if (!result.email) return json({ message: 'No public email was found on the website or its contact pages. You can add a verified business email manually.' });
      await changeState(s => {
        const p = s.prospects.find(p => p.id === input.id); if (!p || p.website !== prospect.website) throw new Error('The prospect changed. Please try again.');
        if (s.suppressed.includes(result.email)) throw new Error('This address has opted out.');
        if (s.prospects.some(other => other.id !== p.id && other.email === result.email)) throw new Error('This email is already assigned to another prospect.');
        p.email = result.email; p.emailVerified = true; p.source = result.source; p.updatedAt = new Date().toISOString();
      });
      return json({ message: `Found ${result.email} on the business website.` });
    }
    const message = await changeState(s => {
      if (action === 'save-prospect') {
        let p = s.prospects.find(p => p.id === input.id);
        if (input.id && !p) throw new Error('Prospect not found.');
        const email = line(input.email, 254).toLowerCase(); const business = line(input.business);
        if (!business) throw new Error('Enter the business name.');
        if (email && !emailValid(email)) throw new Error('Enter a valid email address.');
        if (s.prospects.some(other => other.id !== p?.id && ((email && other.email === email) || other.business.toLowerCase() === business.toLowerCase()))) throw new Error('This business or email is already in your CRM.');
        if (p?.stage === 'unsubscribed' && email !== p.email) throw new Error('An opted-out contact cannot be reassigned.');
        const source = url(input.source);
        const nextFollowUp = date(input.nextFollowUp).slice(0, 10);
        const stage: Stage = stages.includes(input.stage as Stage) ? input.stage as Stage : 'new';
        const now = new Date().toISOString();
        const fields = { business, email, contact: line(input.contact), phone: line(input.phone, 40), website: url(input.website), source,
          category: line(input.category, 100), city: line(input.city, 80) || 'New Bern', offer: offer(input.offer), notes: text(input.notes, 8000),
          emailVerified: input.emailVerified === true && Boolean(source) && Boolean(email), nextFollowUp,
          value: Math.max(0, Math.min(1000000, Number(input.value) || 0)), updatedAt: now,
          stage: (s.suppressed.includes(email) || p?.stage === 'unsubscribed' ? 'unsubscribed' : stage) as Stage };
        if (!p) {
          if (s.prospects.length >= 2000) throw new Error('The prospect limit is 2,000.');
          p = { ...fields, id: randomUUID(), createdAt: now, unsubscribeToken: newToken() };
          s.prospects.unshift(p);
        } else Object.assign(p, fields);
        if (p.stage === 'unsubscribed' && p.email && !s.suppressed.includes(p.email)) s.suppressed.push(p.email);
        for (const e of s.emails) if (e.prospectId === p.id && ['draft', 'queued'].includes(e.status) && (e.to !== p.email || ['replied', 'meeting', 'proposal', 'closed', 'won', 'unsubscribed'].includes(p.stage))) e.status = 'cancelled';
        return 'Prospect saved.';
      }
      if (action === 'draft') {
        const p = s.prospects.find(p => p.id === input.id); if (!p) throw new Error('Prospect not found.');
        if (!eligible(p, s)) throw new Error('Add a verified email and its source before drafting. Opted-out and closed contacts cannot receive emails.');
        if (s.emails.some(e => e.prospectId === p.id && ['draft', 'queued', 'sending', 'uncertain'].includes(e.status))) throw new Error('This prospect already has an unfinished email. Open it in Emails.');
        if (s.emails.length >= 5000) throw new Error('The email history limit has been reached. Export your CRM.');
        s.emails.unshift({ id: randomUUID(), prospectId: p.id, to: p.email, ...renderTemplate(s.settings.templates[p.offer], p), status: 'draft', createdAt: new Date().toISOString(), scheduledAt: new Date().toISOString() });
        return 'Email draft created.';
      }
      if (action === 'save-email' || action === 'queue' || action === 'cancel') {
        const e = s.emails.find(e => e.id === input.id); if (!e) throw new Error('Email not found.');
        if (!['draft', 'queued'].includes(e.status)) throw new Error('Only drafts and queued emails can be changed.');
        if (action === 'cancel') { e.status = 'cancelled'; return 'Email cancelled.'; }
        const p = s.prospects.find(p => p.id === e.prospectId);
        if (!p || p.email !== e.to || !eligible(p, s)) throw new Error('This prospect is no longer eligible for outreach.');
        const subject = line(input.subject, 180); const body = text(input.body, 8000);
        if (!subject || !body) throw new Error('Add a subject and message.');
        e.subject = subject; e.body = body; e.scheduledAt = date(input.scheduledAt) || new Date().toISOString(); e.status = action === 'queue' ? 'queued' : 'draft';
        return action === 'queue' ? 'Email queued. It will send during weekday hours when automation is active.' : 'Draft saved.';
      }
      if (action === 'settings') {
        const dailyLimit = Number(input.dailyLimit);
        if (!(discoveryCategories as readonly string[]).includes(String(input.category))) throw new Error('Choose a listed business category.');
        if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 50) throw new Error('Choose a daily limit between 1 and 50.');
        const from = line(input.from, 250); const replyTo = line(input.replyTo, 254).toLowerCase();
        const sender = (from.match(/<([^<>]+)>$/)?.[1] || from).toLowerCase();
        if (!emailValid(sender) || !sender.endsWith('@captain97.com') || !emailValid(replyTo)) throw new Error('Use a captain97.com sender and a valid reply address.');
        if (input.enabled === true && (!process.env.RESEND_API_KEY || !process.env.CRON_SECRET)) throw new Error('Connect the email provider and scheduler before starting automation.');
        const templates = input.templates as Record<string, Template> | undefined;
        if (!templates) throw new Error('Campaign templates are required.');
        for (const key of Object.keys(offers) as Offer[]) {
          const subject = line(templates[key]?.subject, 180); const body = text(templates[key]?.body, 8000);
          if (!subject || !body) throw new Error('Each campaign needs a subject and message.');
          s.settings.templates[key] = { subject, body };
        }
        Object.assign(s.settings, { enabled: input.enabled === true, autoDiscover: input.autoDiscover === true, autoQueue: input.autoQueue === true, dailyLimit, from, replyTo, discoverySource: discoverySource(input.discoverySource), category: line(input.category, 80) || 'restaurants', defaultOffer: offer(input.defaultOffer) });
        return 'Campaign settings saved.';
      }
      if (action === 'pause') { s.settings.enabled = false; return 'Automatic sending paused.'; }
      throw new Error('Unknown action.');
    });
    return json({ message });
  } catch (error) { return json({ message: error instanceof Error ? error.message : 'This update could not be completed.' }, 400); }
}
