import { sourceCandidates } from '../lib/outreach/sources';
async function main() {
  let localSources = 0;
  for (const [provider, category] of [['visit', 'restaurants'], ['downtown', 'restaurants'], ['maps', 'restaurants'], ['visit', 'retail'], ['visit', 'health'], ['visit', 'marina'], ['visit', 'lodging'], ['downtown', 'retail'], ['downtown', 'lodging']] as const) {
    try {
      const candidates = await sourceCandidates(provider, category);
      console.log(provider + '/' + category + ': ' + candidates.length + ' New Bern listings; ' + candidates.filter(c => c.website).length + ' with business websites');
      if (candidates.length && provider !== 'maps' && category === 'restaurants') localSources++;
    } catch (error) {
      console.log(provider + '/' + category + ': ' + (error instanceof Error ? error.message : 'Unavailable'));

    }
  }
  if (!localSources) throw new Error('Neither independent local directory returned usable listings.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
