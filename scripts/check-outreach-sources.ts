import { sourceCandidates } from '../lib/outreach/sources';
async function main() {
  let localSources = 0;
  for (const provider of ['visit', 'downtown', 'maps'] as const) {
    try {
      const candidates = await sourceCandidates(provider, 'restaurants');
      console.log(provider + ': ' + candidates.length + ' New Bern listings; ' + candidates.filter(c => c.website).length + ' with business websites');
      if (candidates.length && provider !== 'maps') localSources++;
    } catch (error) { console.log(provider + ': ' + (error instanceof Error ? error.message : 'Unavailable')); }
  }
  if (!localSources) throw new Error('Neither independent local directory returned usable listings.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
