import { load } from 'cheerio';
import { randomUUID } from 'node:crypto';
import { changeState, newToken, readState, withLock } from './store';
import { discoveryCategories, discoverySources, emailValid, renderTemplate, type DiscoverySource, type Prospect } from './types';
import { publicUrl, readPublicPage } from './public-web';
import { businessWebsite, collectCandidates, sameBusiness, type DiscoveryBatch, type PageReader } from './sources';
export { directoryMembers } from './sources';
export function publishedEmail(html: string) {
  const $ = load(html); const candidates: string[] = [];
  $('a[href^="mailto:"]').each((_i, el) => {
    try { candidates.push(decodeURIComponent(($(el).attr('href') || '').slice(7).split('?')[0]).trim().toLowerCase()); } catch { /* malformed public link */ }
  });
  // A visible address is evidence too; never synthesize a mailbox from a domain.
  $('script,style,noscript').remove();
  candidates.push(...($.text().match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(s => s.toLowerCase()));
  return candidates.find(e => emailValid(e) && !/^(noreply|no-reply|privacy|abuse|support@wix|example@)/i.test(e) && !/\.(png|jpg|webp|svg)$/i.test(e)) || '';
}
export async function researchWebsite(website: string) {
  const first = await readPublicPage(website); let email = publishedEmail(first.html);
  if (email) return { email, source: first.url };
  const $ = load(first.html); const links: string[] = [];
  $('a[href]').each((_i, el) => {
    if (!/contact|about/i.test($(el).text())) return;
    try { const url = publicUrl(new URL($(el).attr('href')!, first.url).href); if (url.origin === new URL(first.url).origin && url.href !== first.url) links.push(url.href); } catch { /* skip non-web links */ }
  });
  for (const url of [...new Set(links)].slice(0, 2)) {
    try { const page = await readPublicPage(url); email = publishedEmail(page.html); if (email) return { email, source: page.url }; } catch { /* keep the directory prospect without an email */ }
  }
  return { email: '', source: first.url };
}
type DiscoveryIO = {
  collect: (category: string, source: DiscoverySource) => Promise<DiscoveryBatch>;
  research: typeof researchWebsite;
  readPage: PageReader;
};
export async function discover(category: string, source: DiscoverySource = 'all', io: DiscoveryIO = { collect: collectCandidates, research: researchWebsite, readPage: readPublicPage }) {
  if (!(discoveryCategories as readonly string[]).includes(category)) throw new Error('Choose a listed business category.');
  if (!Object.hasOwn(discoverySources, source)) throw new Error('Choose a listed discovery source.');
  return withLock('discovery', async () => {
    const state = await readState();
    if (state.prospects.length >= 2000) throw new Error('The prospect limit is 2,000. Export your CRM before adding more.');
    const batch = await io.collect(category, source);
    const candidates = batch.candidates.filter((p, i, all) =>
      !state.researched.includes(p.key) && !state.prospects.some(old => sameBusiness(old, p))
      && !all.slice(0, i).some(old => sameBusiness(old, p))
      && !/(^|\.)captain97\.com$/i.test(p.website ? new URL(p.website).hostname : '')
    ).slice(0, 4);
    const examined: string[] = []; let failed = 0; let unreadable = 0;
    const results = await Promise.all(candidates.map(async candidate => {
      try {
        let { website, city, phone } = candidate;
        if (candidate.detail) {
          const detail = await io.readPage(candidate.source); const d = load(detail.html);
          city = d('[itemprop="addressLocality"]').first().text().trim();
          if (!/^new bern$/i.test(city)) { examined.push(candidate.key); return null; }
          website = businessWebsite(d('.gz-card-website a[href]').attr('href') || '');
          phone = d('[itemprop="telephone"]').first().text().trim();
        }
        let research = { email: '', source: candidate.source };
        if (website) {
          try { research = await io.research(website); } catch { unreadable++; }
        }
        const now = new Date().toISOString();
        const prospect: Prospect = { id: randomUUID(), business: candidate.business, city, contact: '', email: research.email,
          phone, website, source: research.email ? research.source : candidate.source,
          discoverySource: discoverySources[candidate.provider], discoveryUrl: candidate.source,
          category: candidate.category, offer: state.settings.defaultOffer, stage: 'new',
          notes: 'Found via ' + discoverySources[candidate.provider] + ': ' + candidate.source,
          emailVerified: Boolean(research.email), createdAt: now, updatedAt: now, nextFollowUp: '', value: 0, unsubscribeToken: newToken(),
        };
        examined.push(candidate.key);
        return prospect;
      } catch { failed++; return null; }
    }));
    const prospects = results.filter((p): p is Prospect => p !== null);
    return changeState(s => {
      let added = 0; let ready = 0;
      for (const p of prospects) {
        if (s.prospects.length >= 2000 || s.prospects.some(old => sameBusiness(old, p)) || (p.email && s.suppressed.includes(p.email))) continue;
        s.prospects.unshift(p); added++; if (p.email) ready++;
        if (p.email && s.emails.length < 5000) {
          const draft = renderTemplate(s.settings.templates[p.offer], p);
          s.emails.unshift({ id: randomUUID(), prospectId: p.id, to: p.email, ...draft, status: s.settings.autoQueue ? 'queued' : 'draft', createdAt: p.createdAt, scheduledAt: p.createdAt });
        }
      }
      s.researched = [...new Set([...s.researched, ...examined])];
      s.lastDiscovery = new Date().toISOString();
      const message = 'Searched ' + batch.searched.join(', ') + '. '
        + (candidates.length ? 'Added ' + added + ' New Bern prospects; ' + ready + ' have a published email.' : 'No new businesses found in this category. Try another category or source.')
        + (failed ? ' ' + failed + ' listings could not be read and can be retried.' : '')
        + (unreadable ? ' ' + unreadable + ' business websites could not be read; those prospects need email research.' : '')
        + (batch.warnings.length ? ' ' + batch.warnings.join('. ') + '.' : '');
      s.lastResult = message;
      return message;
    });
  });
}
