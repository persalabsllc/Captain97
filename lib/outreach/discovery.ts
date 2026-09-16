import { load } from 'cheerio';
import { randomUUID } from 'node:crypto';
import { changeState, newToken, readState, withLock } from './store';
import { emailValid, renderTemplate, type Prospect } from './types';
import { publicUrl, readPublicPage } from './public-web';
const directory = 'https://business.newbernchamber.com/list';
export function directoryMembers(html: string) {
  const $ = load(html); const found = new Map<string, string>();
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') || ''; const name = $(el).text().trim();
    if (href.startsWith(`${directory}/member/`) && name) found.set(href, name);
  });
  return [...found].map(([source, business]) => ({ source, business }));
}
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
export async function discover(category: string) {
  return withLock('discovery', async () => {
    const state = await readState();
    if (state.prospects.length >= 2000) throw new Error('The prospect limit is 2,000. Export your CRM before adding more.');
    const index = await readPublicPage(directory); const $ = load(index.html);
    const categories = new Map<string, string>();
    $('a[href]').each((_i, el) => { const href = $(el).attr('href') || ''; if (href.startsWith(`${directory}/ql/`) || href.startsWith(`${directory}/category/`)) categories.set(href, $(el).text().trim()); });
    const words = category.toLowerCase().split(/\s+/).filter(Boolean);
    const match = [...categories].find(([url, label]) => words.every(w => `${url} ${label}`.toLowerCase().includes(w)));
    if (!match) throw new Error('Try a directory category such as restaurants, retail, home, health, automotive, or marina.');
    const page = await readPublicPage(match[0]);
    const candidates = directoryMembers(page.html).filter(p => !state.researched.includes(p.source) && !state.prospects.some(old => old.business.toLowerCase() === p.business.toLowerCase())).slice(0, 4);
    const prospects: Prospect[] = []; const examined: string[] = []; let failed = 0;
    for (const candidate of candidates) {
      try {
        const detail = await readPublicPage(candidate.source); const d = load(detail.html);
        const city = d('[itemprop="addressLocality"]').first().text().trim();
        if (!/^new bern$/i.test(city)) { examined.push(candidate.source); continue; }
        let website = d('.gz-card-website a[href]').attr('href') || '';
        try { website = website ? publicUrl(website).href : ''; } catch { website = ''; }
        let research = { email: '', source: candidate.source };
        if (website && !/(facebook|instagram|linkedin)\.com/i.test(new URL(website).hostname)) {
          try { research = await researchWebsite(website); } catch { /* visible in CRM as needs an email */ }
        }
        const now = new Date().toISOString();
        prospects.push({ id: randomUUID(), business: candidate.business, city, contact: '', email: research.email,
          phone: d('[itemprop="telephone"]').first().text().trim(), website, source: research.email ? research.source : candidate.source,
          category: match[1], offer: state.settings.defaultOffer, stage: 'new', notes: `Found in the New Bern Chamber directory: ${candidate.source}`,
          emailVerified: Boolean(research.email), createdAt: now, updatedAt: now, nextFollowUp: '', value: 0, unsubscribeToken: newToken(),
        });
        examined.push(candidate.source);
      } catch { failed++; }
    }
    return changeState(s => {
      let added = 0; let ready = 0;
      for (const p of prospects) {
        if (s.prospects.length >= 2000 || s.prospects.some(old => old.business.toLowerCase() === p.business.toLowerCase() || (p.email && old.email === p.email)) || (p.email && s.suppressed.includes(p.email))) continue;
        s.prospects.unshift(p); added++; if (p.email) ready++;
        if (p.email && s.emails.length < 5000) {
          const draft = renderTemplate(s.settings.templates[p.offer], p);
          s.emails.unshift({ id: randomUUID(), prospectId: p.id, to: p.email, ...draft, status: s.settings.autoQueue ? 'queued' : 'draft', createdAt: p.createdAt, scheduledAt: p.createdAt });
        }
      }
      s.researched = [...new Set([...s.researched, ...examined])];
      s.lastDiscovery = new Date().toISOString();
      const message = candidates.length ? `Added ${added} New Bern prospects; ${ready} have a published email.${failed ? ` ${failed} websites could not be read.` : ''}` : 'All businesses in this category have been checked. Try another category.';
      s.lastResult = message;
      return message;
    });
  });
}
