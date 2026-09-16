import { sourceCandidates } from '../lib/outreach/sources';
import { readPublicPage } from '../lib/outreach/public-web';
import { load } from 'cheerio';
async function main() {
  let localSources = 0;
  for (const [provider, category] of [['visit', 'restaurants'], ['downtown', 'restaurants'], ['maps', 'restaurants'], ['visit', 'retail'], ['visit', 'health'], ['visit', 'marina'], ['visit', 'lodging'], ['downtown', 'retail'], ['downtown', 'lodging']] as const) {
    try {
      const candidates = await sourceCandidates(provider, category);
      console.log(provider + '/' + category + ': ' + candidates.length + ' New Bern listings; ' + candidates.filter(c => c.website).length + ' with business websites');
      if (candidates.length && provider !== 'maps' && category === 'restaurants') localSources++;
    } catch (error) {
      console.log(provider + '/' + category + ': ' + (error instanceof Error ? error.message : 'Unavailable'));
      if (provider === 'downtown' && category === 'restaurants') {
        const page = await readPublicPage('https://downtownnewbern.com/eat-drink/');
        const $ = load(page.html); let node = $('h4').first();
        for (let level = 0; level < 9 && node.length; level++, node = node.parent()) console.log('card structure: ' + JSON.stringify({ class: node.attr('class'), headings: node.find('h2,h3,h4').length, links: node.find('a[href]').toArray().slice(0,8).map(a => ({ text: $(a).text().trim(), href: $(a).attr('href') })) }));
      }
    }
  }
  if (!localSources) throw new Error('Neither independent local directory returned usable listings.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
