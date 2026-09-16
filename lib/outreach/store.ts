import { randomBytes, randomUUID } from 'node:crypto';
import { getChatRedis } from '../chat-store';
import { defaults, type State } from './types';
const scope = (process.env.VERCEL_ENV || process.env.NODE_ENV || 'development').replace(/[^a-z0-9-]/gi, '');
export const prefix = `captain97:outreach:v1:${scope}`;
const key = `${prefix}:state`;
export async function readState(): Promise<State> {
  const state = await getChatRedis().get<State>(key);
  if (!state) return { revision: 0, prospects: [], emails: [], settings: structuredClone(defaults), suppressed: [], researched: [] };
  state.settings = { ...structuredClone(defaults), ...state.settings };
  return state;
}
// Optimistic transactions preserve edits, opt-outs and send reservations across requests.
export async function changeState<T>(fn: (state: State) => T): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const state = await readState();
    const previous = state.revision;
    const result = fn(state);
    state.revision++;
    const written = await getChatRedis().eval<string[], number>(
      'local raw=redis.call("GET",KEYS[1]); local rev=0; if raw then rev=cjson.decode(raw).revision end; if rev~=tonumber(ARGV[1]) then return 0 end; redis.call("SET",KEYS[1],ARGV[2]); return 1',
      [key], [String(previous), JSON.stringify(state)],
    );
    if (written === 1) return result;
  }
  throw new Error('Another update is in progress. Please try again.');
}
export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const token = randomUUID(); const lock = `${prefix}:lock:${name}`;
  if (!await getChatRedis().set(lock, token, { nx: true, ex: 180 })) throw new Error('This operation is already running. Please try again shortly.');
  try { return await fn(); }
  finally { await getChatRedis().eval('if redis.call("GET",KEYS[1])==ARGV[1] then return redis.call("DEL",KEYS[1]) end return 0', [lock], [token]); }
}
export function newToken() { return randomBytes(32).toString('base64url'); }
export async function unsubscribe(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return false;
  return changeState(state => {
    const p = state.prospects.find(p => p.unsubscribeToken === token);
    if (!p) return false;
    if (!state.suppressed.includes(p.email)) state.suppressed.push(p.email);
    p.stage = 'unsubscribed'; p.updatedAt = new Date().toISOString();
    for (const e of state.emails) if (e.to === p.email && ['draft', 'queued'].includes(e.status)) e.status = 'cancelled';
    return true;
  });
}
