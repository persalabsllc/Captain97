import { load } from 'cheerio';
import { getChatRedis } from '../chat-store';
import { prefix } from './store';
import { discoverySources, type DiscoverySource } from './types';
import { publicUrl, readPublicPage } from './public-web';

export type Candidate = {
  key: string; business: string; website: string; phone: string; city: string;
  source: string; provider: Exclude<DiscoverySource, 'all'>; category: string;
  detail?: boolean;
};
export type DiscoveryBatch = { candidates: Candidate[]; searched: string[]; warnings: string[] };
export type PageReader = typeof readPublicPage;
const chamber = 'https://business.newbernchamber.com/list';
const visit = 'https://visitnewbern.com';
const downtown = 'https://downtownnewbern.com';
const visitPaths: Record<string, string[]> = {
  restaurants: ['/eat-drink/downtown/', '/eat-drink/greater-new-bern/'],
  retail: ['/things-to-do/shopping/apparel/', '/things-to-do/shopping/antiques/', '/things-to-do/shopping/jewelry-unique-gifts/', '/things-to-do/shopping/arts-crafts-galleries/', '/things-to-do/shopping/florists/'],
  health: ['/things-to-do/shopping/health-personal-services/'],
  'personal services': ['/things-to-do/shopping/health-personal-services/'],
  marina: ['/marinas/'],
  lodging: ['/where-to-stay-new-bern-nc/', '/where-to-stay-greater-new-bern-nc/'],
};
const downtownPaths: Record<string, string> = { restaurants: '/eat-drink/', retail: '/shop/', lodging: '/places-to-stay/' };
const mapFilters: Record<string, string[]> = {
  restaurants: ['["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream)$"]'],
  retail: ['["shop"]["shop"!~"^(vacant|car|car_repair|hairdresser|beauty)$"]'],
  home: ['["craft"]', '["shop"~"^(hardware|doityourself|furniture|garden_centre|carpet|flooring)$"]'],
  health: ['["healthcare"]', '["amenity"~"^(dentist|doctors|clinic|pharmacy|veterinary)$"]'],
  automotive: ['["shop"~"^(car|car_repair|car_parts|tyres)$"]', '["amenity"~"^(car_wash|fuel)$"]'],
  marina: ['["leisure"="marina"]', '["shop"="boat"]'],
  'real estate': ['["office"="estate_agent"]'],
  'personal services': ['["shop"~"^(hairdresser|beauty|massage|laundry|dry_cleaning|tattoo)$"]', '["leisure"="fitness_centre"]'],
  lodging: ['["tourism"~"^(hotel|motel|guest_house|hostel|camp_site)$"]'],
};
export function businessName(raw: string) {
  return raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, 'and').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corporation)\b/g, '').trim().replace(/\s+/g, ' ');
}
export function businessWebsite(raw: string) {
  if (!raw) return '';
  try {
    const url = publicUrl(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw);
    return /(^|\.)(facebook\.com|instagram\.com|linkedin\.com|yelp\.com|tripadvisor\.com|visitnewbern\.com|downtownnewbern\.com|newbernchamber\.com|google\.com|maps\.app\.goo\.gl|linktr\.ee)$/.test(url.hostname) ? '' : url.href;
  } catch { return ''; }
}
export function sameBusiness(a: { business: string; website: string; email?: string }, b: { business: string; website: string; email?: string }) {
  if (businessName(a.business) === businessName(b.business)) return true;
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) return true;
  const left = businessWebsite(a.website); const right = businessWebsite(b.website);
  // Domain deduplication also catches shortened names across directories.
  return Boolean(left && right && new URL(left).hostname.replace(/^www\./, '') === new URL(right).hostname.replace(/^www\./, ''));
}
export function directoryMembers(html: string) {
  const $ = load(html); const found = new Map<string, string>();
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') || ''; const name = $(el).text().trim();
    if (href.startsWith(chamber + '/member/') && name) found.set(href, name);
  });
  return [...found].map(([source, business]) => ({ source, business }));
}
export function visitMembers(html: string, source: string, category: string): Candidate[] {
  const $ = load(html); const found: Candidate[] = [];
  $('.e-loop-item.type-locations').each((_i, el) => {
    const card = $(el); const business = card.find('h2,h3,h4').first().text().trim();
    const content = card.find('.elementor-widget-theme-post-content').text();
    if (!business || !/\bNew Bern\b/i.test(content)) return;
    const link = card.find('a[href]').toArray().find(a => /visit website|website/i.test($(a).text()));
    const website = businessWebsite(link ? $(link).attr('href') || '' : '');
    const post = (card.attr('class') || '').match(/\be-loop-item-(\d+)\b/)?.[1];
    found.push({ key: 'visit:' + (post || businessName(business)), business: business.slice(0, 200), website,
      phone: content.match(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] || '',
      city: 'New Bern', category, source, provider: 'visit' });
  });
  return found;
}
export function downtownMembers(html: string, source: string, category: string): Candidate[] {
  const $ = load(html); const found: Candidate[] = [];
  // Business details live in Elementor popups, outside the flip-box front.
  $('h4, .eael-elements-flip-box-heading').each((_i, el) => {
    const business = $(el).text().trim();
    if (!business) return;
    let card = $(el).parent();
    for (let level = 0; level < 10 && card.length; level++, card = card.parent()) {
      const headings = new Set(card.find('h2,h3,h4').toArray().map(h => businessName($(h).text())).filter(Boolean));
      if (headings.size > 1) break;
      const websites = card.find('a[href]').toArray().map(a => businessWebsite($(a).attr('href') || '')).filter(Boolean);
      if (!websites.length) continue;
      const candidate: Candidate = { key: 'downtown:' + businessName(business), business: business.slice(0, 200), website: websites[0],
        phone: card.text().match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] || '',
        city: 'New Bern', category, source, provider: 'downtown' };
      if (!found.some(old => sameBusiness(old, candidate))) found.push(candidate);
      break;
    }
  });
  return found;
}
export function mapMembers(data: unknown, category: string): Candidate[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { elements?: unknown }).elements)) throw new Error('Map results could not be read.');
  const parsed = data as { remark?: string; elements: { id: number; type: string; tags?: Record<string, string> }[] };
  if (parsed.remark) throw new Error('Map search is temporarily busy.');
  return parsed.elements.flatMap(el => {
    const t = el.tags || {};
    if (!['node', 'way', 'relation'].includes(el.type) || !Number.isSafeInteger(el.id) || !t.name || (t['addr:city'] && !/^new bern$/i.test(t['addr:city'])) || t.disused === 'yes' || t.abandoned === 'yes') return [];
    const source = 'https://www.openstreetmap.org/' + el.type + '/' + el.id;
    return [{ key: source, business: t.name.slice(0, 200), website: businessWebsite(t.website || t['contact:website'] || ''),
      phone: (t.phone || t['contact:phone'] || '').slice(0, 80), city: 'New Bern', category, source, provider: 'maps' as const }];
  });
}
export async function readMapCandidates(category: string): Promise<Candidate[]> {
  const filters = mapFilters[category];
  if (!filters) throw new Error('Choose a listed business category.');
  const query = '[out:json][timeout:15][maxsize:33554432];relation["name"="New Bern"]["boundary"="administrative"](35.0,-77.3,35.3,-76.8);map_to_area->.city;('
    + filters.map(f => 'nwr(area.city)["name"]' + f + ';').join('') + ');out tags 1000;';
  // Both public providers permit small projects; cache results and fail over once.
  // Endpoints and filters are fixed, never caller-controlled.
  let response: Response | undefined;
  for (const endpoint of ['https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']) {
    try {
      const result = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Captain97-BusinessResearch/1.0 (+https://captain97.com)' },
        body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(25000), redirect: 'error', cache: 'no-store',
      });
      if (result.ok) { response = result; break; }
      await result.body?.cancel();
    } catch { /* Other sources still work if both map providers are unavailable. */ }
  }
  if (!response) throw new Error('Map search is temporarily unavailable. Other discovery sources can still be used.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Map search returned no data.');
  let raw = ''; let bytes = 0; const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.length; if (bytes > 2_000_000) throw new Error('Map results are too large.');
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
  } finally { await reader.cancel(); }
  return mapMembers(JSON.parse(raw), category);
}
export async function sourceCandidates(provider: Exclude<DiscoverySource, 'all'>, category: string, readPage: PageReader = readPublicPage): Promise<Candidate[]> {
  if (provider === 'maps') return readMapCandidates(category);
  if (provider === 'chamber') {
    const index = await readPage(chamber); const $ = load(index.html); const categories = new Map<string, string>();
    $('a[href]').each((_i, el) => { const href = $(el).attr('href') || ''; if (href.startsWith(chamber + '/ql/') || href.startsWith(chamber + '/category/')) categories.set(href, $(el).text().trim()); });
    const words = category.toLowerCase().split(/\s+/).filter(Boolean);
    const match = [...categories].find(([url, label]) => words.every(w => (url + ' ' + label).toLowerCase().includes(w)));
    if (!match) return [];
    const page = await readPage(match[0]);
    return directoryMembers(page.html).map(c => ({ ...c, key: c.source, website: '', phone: '', city: '', category: match[1], provider, detail: true }));
  }
  const paths = provider === 'visit' ? visitPaths[category] : downtownPaths[category] ? [downtownPaths[category]] : undefined;
  if (!paths) return [];
  const results = await Promise.allSettled(paths.map(async path => {
    const page = await readPage((provider === 'visit' ? visit : downtown) + path);
    const candidates = provider === 'visit' ? visitMembers(page.html, page.url, category) : downtownMembers(page.html, page.url, category);
    if (!candidates.length) throw new Error('No readable listings were found.');
    return candidates;
  }));
  const found = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  if (!found.length && results.some(r => r.status === 'rejected')) throw new Error('Listings are temporarily unavailable.');
  return found;
}
export async function collectCandidates(category: string, source: DiscoverySource, loader: typeof sourceCandidates = sourceCandidates): Promise<DiscoveryBatch> {
  const providers = (source === 'all' ? ['visit', 'downtown', 'maps', 'chamber'] : [source]) as Exclude<DiscoverySource, 'all'>[];
  const supported = providers.filter(p => p === 'maps' || p === 'chamber' || (p === 'visit' ? visitPaths[category] : downtownPaths[category]));
  if (!supported.length) throw new Error('This source does not cover that category. Choose All sources or OpenStreetMap.');
  const results = await Promise.allSettled(supported.map(async provider => {
    const cacheKey = prefix + ':discovery:v2:' + provider + ':' + category;
    const cached = await getChatRedis().get<Candidate[]>(cacheKey);
    if (cached) return cached;
    const candidates = await loader(provider, category);
    await getChatRedis().set(cacheKey, candidates, { ex: 21600 });
    return candidates;
  }));
  const searched: string[] = []; const warnings: string[] = []; const lists: Candidate[][] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { searched.push(discoverySources[supported[i]]); lists.push(r.value); }
    else warnings.push(discoverySources[supported[i]] + ' is temporarily unavailable');
  });
  if (!searched.length) throw new Error(warnings.join('. ') + '. Please try again later.');
  // Round robin gives each independent source a turn in a four-business batch.
  const candidates: Candidate[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map(l => l.length)); i++) for (const list of lists) if (list[i]) candidates.push(list[i]);
  return { candidates, searched, warnings };
}
