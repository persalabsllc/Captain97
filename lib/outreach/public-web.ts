import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
export function publicIPv4(ip: string) {
  const a = ip.split('.').map(Number);
  return isIP(ip) === 4 && ![0, 10, 127].includes(a[0]) && a[0] < 224
    && !(a[0] === 169 && a[1] === 254) && !(a[0] === 172 && a[1] >= 16 && a[1] <= 31)
    && !(a[0] === 192 && [0, 168].includes(a[1])) && !(a[0] === 100 && a[1] >= 64 && a[1] <= 127)
    && !(a[0] === 198 && [18, 19, 51].includes(a[1])) && !(a[0] === 203 && a[1] === 0);
}
export function publicUrl(raw: string) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && url.port !== '443') || isIP(url.hostname) || !url.hostname.includes('.') || /\.(local|internal|localhost|test|invalid)$/i.test(url.hostname)) throw new Error('Use a public business website.');
  url.protocol = 'https:'; url.hash = ''; return url;
}
export async function readPublicPage(raw: string, redirects = 0, deadline = Date.now() + 12000): Promise<{ url: string; html: string }> {
  const url = publicUrl(raw);
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('The business website timed out.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { family: 4, all: true }),
    new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Website lookup timed out.')), remaining); }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(a => !publicIPv4(a.address))) throw new Error('This website is not publicly reachable.');
  // Pin the validated address to this connection; redirects are checked again.
  const result = await new Promise<{ status: number; location?: string; html: string }>((resolve, reject) => {
    const req = request(url, { family: 4, signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())), headers: { 'User-Agent': 'Captain97-BusinessResearch/1.0 (+https://captain97.com)', Accept: 'text/html' }, lookup: (_hostname, _options, cb) => cb(null, addresses[0].address, 4) }, res => {
      const chunks: Buffer[] = []; let size = 0;
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) { res.resume(); resolve({ status: res.statusCode, location: res.headers.location, html: '' }); return; }
      if (!(res.headers['content-type'] || '').includes('text/html')) { res.resume(); reject(new Error('This link is not a webpage.')); return; }
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1_500_000) req.destroy(new Error('The webpage is too large.')); else chunks.push(chunk); });
      res.on('end', () => resolve({ status: res.statusCode || 500, html: Buffer.concat(chunks).toString('utf8') })); res.on('error', reject);
    });
    req.setTimeout(8000, () => req.destroy(new Error('The business website timed out.'))); req.on('error', reject); req.end();
  });
  if (result.location && redirects < 3) return readPublicPage(new URL(result.location, url).href, redirects + 1, deadline);
  if (result.status !== 200) throw new Error(`Business website returned ${result.status}.`);
  return { url: url.href, html: result.html };
}
