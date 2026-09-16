import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { NextRequest } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { defaults, sendingWindow, renderTemplate, type Prospect, type Email } from '../lib/outreach/types';
import { publicIPv4, publicUrl } from '../lib/outreach/public-web';
import { discover, directoryMembers, publishedEmail } from '../lib/outreach/discovery';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.outreach.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
process.env.RESEND_API_KEY = 'test-only';
process.env.CRON_SECRET = 'test-only';
const database = new Map<string, string>();
let deliveries: Record<string, unknown>[] = []; let provider: 'ok' | 'reject' | 'timeout' = 'ok';
function execute(command: unknown[]): unknown {
  const [raw, ...args] = command; const op = String(raw).toLowerCase(); const key = String(args[0]);
  if (op === 'get') return database.get(key) ?? null;
  if (op === 'set') { if (args.some(v => String(v).toLowerCase() === 'nx') && database.has(key)) return null; database.set(key, String(args[1])); return 'OK'; }
  if (op === 'eval') {
    const script = String(args[0]); const count = Number(args[1]); const keys = args.slice(2, 2 + count).map(String); const argv = args.slice(2 + count).map(String);
    if (script.includes('local rev=0')) {
      const current = JSON.parse(database.get(keys[0]) || '{"revision":0}'); if (current.revision !== Number(argv[0])) return 0;
      database.set(keys[0], argv[1]); return 1;
    }
    if (script.includes('redis.call("DEL"')) { if (database.get(keys[0]) === argv[0]) { database.delete(keys[0]); return 1; } return 0; }
    throw new Error(`Unexpected test Redis script: ${script}`);
  }
  throw new Error(`Unexpected test Redis command ${op}`);
}
function encode(value: unknown): unknown { return typeof value === 'string' && value !== 'OK' ? Buffer.from(value).toString('base64') : value; }
globalThis.fetch = async (input, init) => {
  const target = String(input);
  if (target.startsWith('https://api.resend.com/')) {
    deliveries.push(JSON.parse(String(init?.body)));
    if (provider === 'timeout') throw new Error('Simulated network interruption');
    return Response.json(provider === 'reject' ? { message: 'Sender is not verified.' } : { id: `test-message-${deliveries.length}` }, { status: provider === 'reject' ? 403 : 200 });
  }
  if (!target.startsWith('https://redis.outreach.invalid')) throw new Error(`No external requests allowed in test: ${target}`);
  const command = JSON.parse(String(init?.body));
  return Response.json(Array.isArray(command[0]) ? command.map((c: unknown[]) => ({ result: encode(execute(c)) })) : { result: encode(execute(command)) });
};
import { CHAT_KEY_PREFIX } from '../lib/chat-store';
import { changeState, readState, unsubscribe, prefix } from '../lib/outreach/store';
import { sendNext } from '../lib/outreach/sender';
import { GET, POST } from '../app/api/outreach/route';
const cookie = 'test-session-no-production-access';
const authPrefix = CHAT_KEY_PREFIX;
function p(): Prospect { return { id: 'p1', business: 'Test Marina', contact: 'Sam', email: 'sam@example.com', phone: '', website: 'https://example.com', source: 'https://example.com/contact', category: 'Marina', city: 'New Bern', offer: 'radio', stage: 'new', notes: '', emailVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), nextFollowUp: '', value: 0, unsubscribeToken: randomBytes(32).toString('base64url') }; }
function e(): Email { return { id: 'e1', prospectId: 'p1', to: 'sam@example.com', subject: 'A local partnership', body: 'Hello Sam', status: 'draft', createdAt: new Date().toISOString(), scheduledAt: new Date().toISOString() }; }
async function seed() { await changeState(s => { s.prospects = [p()]; s.emails = [e()]; }); }
function request(body?: object, authorized = true, origin = 'https://captain97.com') { return new NextRequest('https://captain97.com/api/outreach', { method: body ? 'POST' : 'GET', headers: { ...(authorized ? { cookie: `captain97_studio_session=${cookie}` } : {}), origin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
beforeEach(() => {
  database.clear(); deliveries = []; provider = 'ok'; delete process.env.VERCEL_ENV;
  database.set(`${authPrefix}:studio-auth-state`, JSON.stringify({ credential: { salt: 'a'.repeat(32), hash: 'b'.repeat(128) }, version: 1 }));
  database.set(`${authPrefix}:studio-session:${createHash('sha256').update(cookie).digest('hex')}`, JSON.stringify({ createdAt: new Date().toISOString(), version: 1 }));
});
test('CRM rejects unauthenticated reads and cross-origin mutations', async () => {
  assert.equal((await GET(request(undefined, false))).status, 401);
  assert.equal((await POST(request({ action: 'pause' }, true, 'https://other.example.com'))).status, 403);
  assert.equal((await GET(request())).status, 200);
});
test('saving, drafting, editing and queueing persist through the actual API', async () => {
  const prospect = p(); const { id: _id, ...fields } = prospect; void _id;
  assert.equal((await POST(request({ action: 'save-prospect', ...fields }))).status, 200);
  const state = await readState(); const id = state.prospects[0].id;
  assert.equal((await POST(request({ action: 'draft', id }))).status, 200);
  assert.equal((await POST(request({ action: 'draft', id }))).status, 400);
  const email = (await readState()).emails[0];
  assert.equal((await POST(request({ action: 'queue', id: email.id, subject: 'Edited subject', body: 'Edited message' }))).status, 200);
  assert.equal((await readState()).emails[0].status, 'queued');
  assert.equal((await readState()).emails[0].subject, 'Edited subject');
});
test('duplicate manual send is rejected and provider acceptance is recorded', async () => {
  await seed(); await sendNext('e1'); await assert.rejects(sendNext('e1'), /already been processed/);
  assert.equal(deliveries.length, 1); assert.equal((await readState()).emails[0].status, 'sent');
  assert.match(String(deliveries[0].text), /Unsubscribe:/); assert.equal(deliveries[0].reply_to, 'kyle@captain97.com');
});
test('opt-out cancels pending mail and blocks future outreach', async () => {
  await seed(); const token = (await readState()).prospects[0].unsubscribeToken;
  assert.equal(await unsubscribe(token), true);
  await assert.rejects(sendNext('e1'));
  assert.equal(deliveries.length, 0); assert.deepEqual((await readState()).suppressed, ['sam@example.com']);
  assert.equal((await readState()).emails[0].status, 'cancelled');
});
test('provider rejection does not become sent; uncertain delivery is never retried', async () => {
  await seed(); provider = 'reject'; await assert.rejects(sendNext('e1'), /403/);
  assert.equal((await readState()).emails[0].status, 'failed');
  await changeState(s => { s.emails = [e()]; }); provider = 'timeout';
  await assert.rejects(sendNext('e1'), /interrupted/);
  assert.equal((await readState()).emails[0].status, 'uncertain');
  await assert.rejects(sendNext('e1'), /already been processed/);
  assert.equal(deliveries.length, 2);
});
test('daily cap applies to manual sends and previews cannot email prospects', async () => {
  await seed(); await changeState(s => { s.settings.dailyLimit = 1; s.emails.push({ ...e(), id: 'e2' }); });
  await sendNext('e1'); await assert.rejects(sendNext('e2'), /daily sending limit/);
  process.env.VERCEL_ENV = 'preview'; await assert.rejects(sendNext('e2'), /preview/); assert.equal(deliveries.length, 1);
});
test('concurrent CRM updates preserve both changes', async () => {
  await Promise.all([changeState(s => { s.researched.push('a'); }), changeState(s => { s.researched.push('b'); })]);
  assert.deepEqual((await readState()).researched.sort(), ['a', 'b']); assert.ok(database.has(`${prefix}:state`));
});
test('recording a reply cancels queued outreach', async () => {
  await seed(); const prospect = (await readState()).prospects[0];
  assert.equal((await POST(request({ action: 'save-prospect', ...prospect, stage: 'replied' }))).status, 200);
  assert.equal((await readState()).emails[0].status, 'cancelled');
});
test('public research rejects internal destinations and extracts only published contacts', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1']) assert.equal(publicIPv4(ip), false);
  assert.equal(publicIPv4('8.8.8.8'), true);
  for (const raw of ['http://localhost', 'http://127.0.0.1', 'file:///etc/passwd', 'https://user:password@example.com', 'https://example.com:8080']) assert.throws(() => publicUrl(raw));
  assert.equal(publishedEmail('<a href="mailto:hello@sample-business.com">Email</a>'), 'hello@sample-business.com');
  assert.equal(publishedEmail('<p>No public email here</p>'), '');
  assert.equal(directoryMembers('<a href="https://business.newbernchamber.com/list/member/test-1">Business</a>').length, 1);
});
test('Eastern sending hours respect daylight saving time and weekends', () => {
  assert.equal(sendingWindow(new Date('2026-09-16T13:00:00Z')), true);
  assert.equal(sendingWindow(new Date('2026-09-16T21:00:00Z')), false);
  assert.equal(sendingWindow(new Date('2026-09-19T15:00:00Z')), false);
  assert.equal(sendingWindow(new Date('2026-12-16T13:00:00Z')), false);
  assert.equal(sendingWindow(new Date('2026-12-16T14:00:00Z')), true);
  assert.match(renderTemplate(defaults.templates.radio, { ...p(), contact: '' }).body, /Test Marina team/);
});


import { businessWebsite, collectCandidates, downtownMembers, mapMembers, sameBusiness, visitMembers, type Candidate } from '../lib/outreach/sources';
function candidate(business: string, provider: Candidate['provider'] = 'visit', website = 'https://local-business.com/'): Candidate {
  return { business, provider, website, key: provider + ':' + business, source: 'https://visitnewbern.com/eat-drink/downtown/', phone: '', city: 'New Bern', category: 'restaurants' };
}
test('tourism parser requires a local address and keeps the business website', () => {
  const html = '<div class="e-loop-item type-locations e-loop-item-12"><h3>Independent Cafe</h3><div class="elementor-widget-theme-post-content">123 Main St, New Bern, NC 28560 (252) 555-0100 <a href="https://independent-cafe.com/">Visit Website</a></div></div>'
    + '<div class="e-loop-item type-locations"><h3>Outside Cafe</h3><div class="elementor-widget-theme-post-content">Havelock, NC <a href="https://outside-cafe.com/">Visit Website</a></div></div>';
  const found = visitMembers(html, 'https://visitnewbern.com/eat-drink/downtown/', 'restaurants');
  assert.equal(found.length, 1); assert.equal(found[0].key, 'visit:12'); assert.equal(found[0].website, 'https://independent-cafe.com/');
  assert.equal(found[0].phone, '(252) 555-0100');
});
test('downtown listings and maps produce prospects without trusting directory email addresses', () => {
  const downtown = downtownMembers('<div class="eael-elements-flip-box-container"><h2 class="eael-elements-flip-box-heading">Corner Shop</h2><a href="https://corner-shop.com/">Website</a></div>', 'https://downtownnewbern.com/shop/', 'retail');
  assert.equal(downtown.length, 1); assert.equal(downtown[0].business, 'Corner Shop');
  const maps = mapMembers({ elements: [
    { type: 'node', id: 1, tags: { name: 'Independent Salon', website: 'salon.com', email: 'unverified@salon.com', 'addr:city': 'New Bern' } },
    { type: 'node', id: 2, tags: { name: 'Other Salon', 'addr:city': 'Havelock' } },
  ] }, 'personal services');
  assert.equal(maps.length, 1); assert.equal(maps[0].website, 'https://salon.com/'); assert.equal('email' in maps[0], false);
  assert.equal(maps[0].source, 'https://www.openstreetmap.org/node/1');
  assert.throws(() => mapMembers({ elements: [], remark: 'timeout' }, 'retail'), /busy/);
  assert.equal(businessWebsite('https://facebook.com/shared-listing'), '');
  assert.equal(businessWebsite('http://127.0.0.1/private'), '');
});
test('cross-source duplicates match punctuation, legal suffixes, websites and emails', () => {
  assert.equal(sameBusiness(candidate("Baker’s Kitchen LLC", 'visit', ''), candidate("Baker's Kitchen", 'chamber', '')), true);
  assert.equal(sameBusiness(candidate('Long Cafe Name', 'visit', 'https://www.cafe.com/menu'), candidate('Cafe', 'downtown', 'https://cafe.com/')), true);
  assert.equal(sameBusiness(candidate('First', 'visit', ''), candidate('Second', 'maps', '')), false);
});
test('all-source discovery interleaves results, caches them and reports partial failures', async () => {
  let calls = 0;
  const loader = async (provider: Candidate['provider']) => {
    calls++;
    if (provider === 'maps') throw new Error('Provider timeout');
    return [candidate(provider + ' one', provider), candidate(provider + ' two', provider)];
  };
  const batch = await collectCandidates('restaurants', 'all', loader);
  assert.deepEqual(batch.candidates.slice(0, 4).map(c => c.provider), ['visit', 'downtown', 'chamber', 'visit']);
  assert.equal(batch.warnings.length, 1); assert.match(batch.warnings[0], /OpenStreetMap/);
  await collectCandidates('restaurants', 'all', loader);
  assert.equal(calls, 5); // Successful lists reused; only the failed source retried.
  await assert.rejects(collectCandidates('automotive', 'visit', loader), /does not cover/);
});
test('broader discovery persists new prospects and source links, deduplicates and honors opt-outs', async () => {
  await changeState(s => { s.settings.autoQueue = true; s.suppressed.push('optout@business.com'); });
  const collect = async () => ({ searched: ['Visit New Bern', 'Downtown New Bern'], warnings: [], candidates: [
    candidate('Independent Cafe', 'visit', 'https://cafe.com'),
    candidate('Independent Cafe & Bakery', 'downtown', 'https://www.cafe.com/menu'),
    candidate('No Email Shop', 'maps', 'https://shop.com'),
    candidate('Opted Out', 'visit', 'https://optout.com'),
  ] });
  const research = async (website: string) => ({ source: website + '/contact', email: website.includes('cafe') ? 'hello@cafe.com' : website.includes('optout') ? 'optout@business.com' : '' });
  const readPage = async () => { throw new Error('No directory details expected.'); };
  await discover('restaurants', 'all', { collect, research, readPage });
  const state = await readState();
  assert.equal(state.prospects.length, 2); assert.equal(state.emails.length, 1); assert.equal(state.emails[0].status, 'queued');
  const cafe = state.prospects.find(p => p.business === 'Independent Cafe')!;
  assert.equal(cafe.discoverySource, 'Visit New Bern'); assert.equal(cafe.source, 'https://cafe.com/contact'); assert.ok(cafe.discoveryUrl);
  assert.equal(state.prospects.find(p => p.business === 'No Email Shop')!.emailVerified, false);
  await discover('restaurants', 'all', { collect, research, readPage });
  assert.equal((await readState()).prospects.length, 2); assert.equal((await readState()).emails.length, 1);
  assert.equal(deliveries.length, 0);
});
test('existing settings gain broader discovery without changing sending preferences', async () => {
  await seed();
  const state = await readState(); const legacy = JSON.parse(JSON.stringify(state)); delete legacy.settings.discoverySource;
  legacy.settings.enabled = false; legacy.settings.dailyLimit = 7;
  database.set(prefix + ':state', JSON.stringify(legacy));
  const migrated = await readState();
  assert.equal(migrated.settings.discoverySource, 'all'); assert.equal(migrated.settings.enabled, false); assert.equal(migrated.settings.dailyLimit, 7);
});
test('API saves discovery source and rejects invalid search choices', async () => {
  const result = await POST(request({ action: 'settings', ...defaults, discoverySource: 'visit' }));
  assert.equal(result.status, 200); assert.equal((await readState()).settings.discoverySource, 'visit');
  assert.equal((await POST(request({ action: 'discover', category: 'restaurants', source: 'not-a-source' }))).status, 400);
  assert.equal((await POST(request({ action: 'discover', category: 'invalid-category', source: 'all' }))).status, 400);
});

test('downtown popup details stay paired with their business across multiple cards', () => {
  const html = '<main><h2>Directory</h2>'
    + '<section><div class="flip"><h2 class="eael-elements-flip-box-heading">Cafe One</h2></div><div class="popup"><div><h4>Cafe One</h4></div><p><a href="https://cafe-one.com">Website</a></p></div></section>'
    + '<section><div class="flip"><h2 class="eael-elements-flip-box-heading">Shop Two</h2></div><div class="popup"><div><h4>Shop Two</h4></div><p><a href="https://shop-two.com">Website</a></p></div></section>'
    + '<section><h4>No Website</h4></section></main>';
  const listings = downtownMembers(html, 'https://downtownnewbern.com/shop/', 'retail');
  assert.deepEqual(listings.map(p => [p.business, p.website]), [['Cafe One', 'https://cafe-one.com/'], ['Shop Two', 'https://shop-two.com/']]);
});
