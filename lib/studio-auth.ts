import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { CHAT_KEY_PREFIX, getChatRedis } from './chat-store';

export const STUDIO_USERNAME = 'studio';
export const STUDIO_SESSION_COOKIE = 'captain97_studio_session';

const LISTENER_CHAT_COOKIE = 'captain97_listener_chat';
const SESSION_KEY_PREFIX = `${CHAT_KEY_PREFIX}:studio-session:`;
const AUTH_STATE_KEY = `${CHAT_KEY_PREFIX}:studio-auth-state`;
const AUTH_BOOTSTRAP_KEY = `${CHAT_KEY_PREFIX}:studio-auth-initialized`;
const STUDIO_SESSION_SECONDS = 30 * 24 * 60 * 60;
const LISTENER_SESSION_SECONDS = 30 * 24 * 60 * 60;

type StoredCredential = {
  readonly salt: string;
  readonly hash: string;
};

type StudioAuthState = {
  readonly credential: StoredCredential;
  readonly version: number;
};

type StudioSession = {
  readonly createdAt: string;
  readonly version: number;
};

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function sessionKey(token: string) {
  return `${SESSION_KEY_PREFIX}${hashToken(token)}`;
}

function passwordHash(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex');
}

function secureStringMatches(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length
    && timingSafeEqual(expectedBuffer, actualBuffer);
}

function configuredInitialAuthState(): StudioAuthState {
  const salt = process.env.STUDIO_INITIAL_PASSWORD_SALT;
  const hash = process.env.STUDIO_INITIAL_PASSWORD_HASH;
  if (!salt || !hash || !/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(hash)) {
    throw new Error('The studio launch credential is not configured.');
  }
  return { credential: { salt, hash }, version: 1 };
}

function isValidAuthState(value: StudioAuthState | null): value is StudioAuthState {
  return Boolean(
    value
    && typeof value.credential?.salt === 'string'
    && /^[a-f0-9]{32}$/i.test(value.credential.salt)
    && typeof value.credential.hash === 'string'
    && /^[a-f0-9]{128}$/i.test(value.credential.hash)
    && Number.isSafeInteger(value.version)
    && value.version >= 1,
  );
}

async function readAuthState() {
  const client = getChatRedis();
  const stored = await client.get<StudioAuthState>(AUTH_STATE_KEY);
  if (stored) {
    if (!isValidAuthState(stored)) throw new Error('The studio authentication state is invalid.');
    return { state: stored, initialized: true as const };
  }

  const initialized = await client.get<boolean>(AUTH_BOOTSTRAP_KEY);
  if (initialized) throw new Error('The studio authentication state is unavailable.');
  return { state: configuredInitialAuthState(), initialized: false as const };
}

async function initializeAuthState(initialAuthState: StudioAuthState) {
  const client = getChatRedis();
  await client.multi()
    .set(AUTH_STATE_KEY, initialAuthState, { nx: true })
    .set(AUTH_BOOTSTRAP_KEY, true, { nx: true })
    .exec();

  const stored = await client.get<StudioAuthState>(AUTH_STATE_KEY);
  if (!isValidAuthState(stored)) throw new Error('The studio authentication state could not be initialized.');
  if (
    stored.version !== initialAuthState.version
    || stored.credential.salt !== initialAuthState.credential.salt
    || stored.credential.hash !== initialAuthState.credential.hash
  ) {
    return null;
  }
  return stored;
}

async function sessionVersion() {
  return (await readAuthState()).state.version;
}

function newStudioSession(version: number) {
  const token = randomBytes(32).toString('base64url');
  const session: StudioSession = {
    createdAt: new Date().toISOString(),
    version,
  };
  return { token, session, key: sessionKey(token) };
}

export async function verifyStudioCredentials(username: string, password: string) {
  if (username.toLowerCase() !== STUDIO_USERNAME) return null;
  const auth = await readAuthState();
  const candidate = passwordHash(password, auth.state.credential.salt);
  const valid = secureStringMatches(auth.state.credential.hash, candidate);
  if (!valid) return null;
  const state = auth.initialized ? auth.state : await initializeAuthState(auth.state);
  if (!state) return null;
  return { version: state.version };
}

export async function createStudioSession(version: number) {
  const pending = newStudioSession(version);
  const created = await getChatRedis().eval<string[], number>(
    [
      'local raw = redis.call("GET", KEYS[1])',
      'if not raw then return 0 end',
      'local current = cjson.decode(raw)',
      'if tonumber(current.version) ~= tonumber(ARGV[1]) then return 0 end',
      'redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3])',
      'return 1',
    ].join('\n'),
    [AUTH_STATE_KEY, pending.key],
    [String(version), JSON.stringify(pending.session), String(STUDIO_SESSION_SECONDS)],
  );
  return created === 1 ? pending.token : null;
}

export function setStudioSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(STUDIO_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: STUDIO_SESSION_SECONDS,
  });
}

export async function readStudioSession(request: NextRequest) {
  const token = request.cookies.get(STUDIO_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getChatRedis().get<StudioSession>(sessionKey(token));
  if (!session || session.version !== await sessionVersion()) return null;
  return { token, session };
}

export async function deleteStudioSession(request: NextRequest) {
  const token = request.cookies.get(STUDIO_SESSION_COOKIE)?.value;
  if (token) await getChatRedis().del(sessionKey(token));
}

export function clearStudioSessionCookie(response: NextResponse) {
  response.cookies.set(STUDIO_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function changeStudioPassword(currentPassword: string, newPassword: string) {
  const verified = await verifyStudioCredentials(STUDIO_USERNAME, currentPassword);
  if (!verified) return null;

  const current = (await readAuthState()).state;
  if (current.version !== verified.version) return null;
  const salt = randomBytes(16).toString('hex');
  const credential: StoredCredential = {
    salt,
    hash: passwordHash(newPassword, salt),
  };
  const state: StudioAuthState = {
    credential,
    version: current.version + 1,
  };
  const pending = newStudioSession(state.version);
  const client = getChatRedis();
  const changed = await client.eval<string[], number>(
    [
      'local raw = redis.call("GET", KEYS[1])',
      'if not raw then return 0 end',
      'local current = cjson.decode(raw)',
      'if tonumber(current.version) ~= tonumber(ARGV[1]) then return 0 end',
      'if current.credential.hash ~= ARGV[2] then return 0 end',
      'redis.call("SET", KEYS[1], ARGV[3])',
      'redis.call("SET", KEYS[2], "true")',
      'redis.call("SET", KEYS[3], ARGV[4], "EX", ARGV[5])',
      'return 1',
    ].join('\n'),
    [AUTH_STATE_KEY, AUTH_BOOTSTRAP_KEY, pending.key],
    [
      String(current.version),
      current.credential.hash,
      JSON.stringify(state),
      JSON.stringify(pending.session),
      String(STUDIO_SESSION_SECONDS),
    ],
  );
  if (changed !== 1) return null;

  return pending.token;
}

export function setListenerChatCookie(
  response: NextResponse,
  conversationId: string,
  accessToken: string,
) {
  response.cookies.set(LISTENER_CHAT_COOKIE, `${conversationId}.${accessToken}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: LISTENER_SESSION_SECONDS,
  });
}

export function readListenerChatCookie(request: NextRequest) {
  const raw = request.cookies.get(LISTENER_CHAT_COOKIE)?.value;
  if (!raw) return null;
  const separator = raw.indexOf('.');
  if (separator < 1) return null;

  const conversationId = raw.slice(0, separator);
  const accessToken = raw.slice(separator + 1);
  if (!conversationId || !accessToken) return null;
  return { conversationId, accessToken };
}

export function clearListenerChatCookie(response: NextResponse) {
  response.cookies.set(LISTENER_CHAT_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
