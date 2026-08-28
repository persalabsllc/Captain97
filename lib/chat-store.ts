import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Redis } from '@upstash/redis';
import {
  chatPreview,
  type ChatConversationStatus,
  type ChatMessage,
  type ChatSender,
  type PublicChatConversation,
  type StudioAvailability,
  type StudioChatConversation,
  type StudioConversationSummary,
} from './chat';

const deploymentScope = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development')
  .replace(/[^a-z0-9-]/gi, '')
  .toLowerCase()
  .slice(0, 32) || 'development';

export const CHAT_KEY_PREFIX = `captain97:listener-chat:v1:${deploymentScope}`;
const KEY_PREFIX = CHAT_KEY_PREFIX;
const INBOX_KEY = `${KEY_PREFIX}:inbox`;
const INBOX_VERSION_KEY = `${KEY_PREFIX}:inbox-version`;
const AVAILABILITY_KEY = `${KEY_PREFIX}:studio-availability`;
const CONVERSATION_TTL_SECONDS = 180 * 24 * 60 * 60;
const CLOSED_CONVERSATION_TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_STORED_MESSAGES = 500;
const MAX_RETURNED_MESSAGES = 250;
const AVAILABILITY_FRESH_MS = 150_000;

let redis: Redis | null | undefined;

export class ChatStoreUnavailableError extends Error {
  constructor() {
    super('Chat storage is not configured.');
    this.name = 'ChatStoreUnavailableError';
  }
}

export type ChatConversationRecord = {
  readonly id: string;
  readonly accessTokenHash: string;
  readonly name: string;
  readonly email: string;
  readonly status: ChatConversationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastMessageAt: string;
  readonly lastMessagePreview: string;
  readonly lastMessageSender: ChatSender;
  readonly unreadByStudio: boolean;
  readonly revision: number;
  readonly hostAtStart?: string;
};

function conversationKey(id: string) {
  return `${KEY_PREFIX}:conversation:${id}`;
}

function messagesKey(id: string) {
  return `${KEY_PREFIX}:messages:${id}`;
}

function hashAccessToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function accessTokenMatches(expectedHash: string, token: string) {
  const actualHash = hashAccessToken(token);
  const expected = Buffer.from(expectedHash);
  const actual = Buffer.from(actualHash);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function getChatRedis() {
  if (redis !== undefined) {
    if (!redis) throw new ChatStoreUnavailableError();
    return redis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;

  if (!redis) throw new ChatStoreUnavailableError();
  return redis;
}

async function readMessages(id: string) {
  return getChatRedis().lrange<ChatMessage>(messagesKey(id), -MAX_RETURNED_MESSAGES, -1);
}

function toSummary(record: ChatConversationRecord): StudioConversationSummary {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastMessageAt: record.lastMessageAt,
    lastMessagePreview: record.lastMessagePreview,
    lastMessageSender: record.lastMessageSender,
    unreadByStudio: Boolean(record.unreadByStudio),
    revision: Number(record.revision) || 1,
    ...(record.hostAtStart ? { hostAtStart: record.hostAtStart } : {}),
  };
}

function toPublicConversation(
  record: ChatConversationRecord,
  messages: readonly ChatMessage[],
): PublicChatConversation {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    messages,
  };
}

export async function consumeChatRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
) {
  const client = getChatRedis();
  const key = chatRateLimitKey(scope, identifier);
  const attempts = await client.eval<string[], number>(
    [
      'local attempts = redis.call("INCR", KEYS[1])',
      'if attempts == 1 then',
      '  redis.call("EXPIRE", KEYS[1], ARGV[1])',
      'end',
      'return attempts',
    ].join('\n'),
    [key],
    [String(windowSeconds)],
  );

  return attempts > limit;
}

function chatRateLimitKey(scope: string, identifier: string) {
  const safeScope = scope.replace(/[^a-z0-9:-]/gi, '').slice(0, 80);
  const safeIdentifier = createHash('sha256').update(identifier).digest('hex').slice(0, 32);
  return `${KEY_PREFIX}:rate:${safeScope}:${safeIdentifier}`;
}

export async function resetChatRateLimit(scope: string, identifier: string) {
  await getChatRedis().del(chatRateLimitKey(scope, identifier));
}

export async function createChatConversation(input: {
  name: string;
  email: string;
  message: string;
  hostAtStart?: string;
}) {
  const client = getChatRedis();
  const id = randomUUID();
  const accessToken = randomBytes(32).toString('base64url');
  const now = new Date().toISOString();
  const initialMessage: ChatMessage = {
    id: randomUUID(),
    sender: 'listener',
    body: input.message,
    createdAt: now,
    displayName: input.name,
  };
  const record: ChatConversationRecord = {
    id,
    accessTokenHash: hashAccessToken(accessToken),
    name: input.name,
    email: input.email,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    lastMessagePreview: chatPreview(input.message),
    lastMessageSender: 'listener',
    unreadByStudio: true,
    revision: 1,
    ...(input.hostAtStart ? { hostAtStart: input.hostAtStart } : {}),
  };

  await client.multi()
    .hset(conversationKey(id), record)
    .rpush(messagesKey(id), initialMessage)
    .zadd(INBOX_KEY, { score: Date.now(), member: id })
    .incr(INBOX_VERSION_KEY)
    .expire(conversationKey(id), CONVERSATION_TTL_SECONDS)
    .expire(messagesKey(id), CONVERSATION_TTL_SECONDS)
    .exec();

  return {
    accessToken,
    conversation: toPublicConversation(record, [initialMessage]),
  };
}

export async function readConversationRecord(id: string) {
  return getChatRedis().hgetall<ChatConversationRecord>(conversationKey(id));
}

export async function readListenerConversation(id: string, accessToken: string) {
  const record = await readConversationRecord(id);
  if (!record || !accessTokenMatches(record.accessTokenHash, accessToken)) return null;
  const messages = await readMessages(id);
  return toPublicConversation(record, messages);
}

async function appendMessage(
  record: ChatConversationRecord,
  sender: ChatSender,
  body: string,
  displayName: string,
) {
  const client = getChatRedis();
  const now = new Date().toISOString();
  const message: ChatMessage = {
    id: randomUUID(),
    sender,
    body,
    createdAt: now,
    displayName,
  };

  const result = await client.eval<string[], number>(
    [
      'if redis.call("EXISTS", KEYS[1]) == 0 then return -1 end',
      'if redis.call("HGET", KEYS[1], "status") ~= "open" then return 0 end',
      'redis.call("RPUSH", KEYS[2], ARGV[1])',
      'redis.call("LTRIM", KEYS[2], -tonumber(ARGV[8]), -1)',
      'redis.call("HSET", KEYS[1],',
      '  "updatedAt", ARGV[2],',
      '  "lastMessageAt", ARGV[2],',
      '  "lastMessagePreview", ARGV[3],',
      '  "lastMessageSender", ARGV[4])',
      'if ARGV[4] == "listener" then',
      '  redis.call("HSET", KEYS[1], "unreadByStudio", "true")',
      'end',
      'redis.call("HINCRBY", KEYS[1], "revision", 1)',
      'redis.call("ZADD", KEYS[3], ARGV[5], ARGV[6])',
      'redis.call("INCR", KEYS[4])',
      'redis.call("EXPIRE", KEYS[1], ARGV[7])',
      'redis.call("EXPIRE", KEYS[2], ARGV[7])',
      'return 1',
    ].join('\n'),
    [conversationKey(record.id), messagesKey(record.id), INBOX_KEY, INBOX_VERSION_KEY],
    [
      JSON.stringify(message),
      now,
      chatPreview(body),
      sender,
      String(Date.now()),
      record.id,
      String(CONVERSATION_TTL_SECONDS),
      String(MAX_STORED_MESSAGES),
    ],
  );

  return { result, message };
}

export async function appendListenerMessage(
  id: string,
  accessToken: string,
  body: string,
) {
  const record = await readConversationRecord(id);
  if (!record || !accessTokenMatches(record.accessTokenHash, accessToken)) return null;
  if (record.status !== 'open') return { closed: true as const };

  const appended = await appendMessage(record, 'listener', body, record.name);
  if (appended.result === -1) return null;
  if (appended.result === 0) return { closed: true as const };
  return { closed: false as const, message: appended.message };
}

export async function appendStudioMessage(
  id: string,
  body: string,
  displayName: string,
) {
  const record = await readConversationRecord(id);
  if (!record) return null;
  if (record.status !== 'open') return { closed: true as const };

  const appended = await appendMessage(record, 'studio', body, displayName);
  if (appended.result === -1) return null;
  if (appended.result === 0) return { closed: true as const };
  return { closed: false as const, message: appended.message };
}

export async function listStudioConversations() {
  const client = getChatRedis();
  const ids = await client.zrange<string[]>(INBOX_KEY, 0, -1, { rev: true });
  if (!ids.length) return [];

  const pipeline = client.pipeline();
  ids.forEach((id) => pipeline.hgetall<ChatConversationRecord>(conversationKey(id)));
  const records = await pipeline.exec<Array<ChatConversationRecord | null>>();
  const missingIds: string[] = [];
  const conversations = records.flatMap((record, index) => {
    if (!record) {
      missingIds.push(ids[index]);
      return [];
    }
    return [toSummary(record)];
  });

  if (missingIds.length) await client.zrem(INBOX_KEY, ...missingIds);
  return conversations;
}

export async function readStudioInboxVersion() {
  return await getChatRedis().get<number>(INBOX_VERSION_KEY) ?? 0;
}

export async function readStudioConversation(
  id: string,
  knownRevision?: number,
): Promise<
  | { readonly unchanged: true; readonly revision: number }
  | { readonly unchanged: false; readonly conversation: StudioChatConversation }
  | null
> {
  const record = await readConversationRecord(id);
  if (!record) return null;
  const revision = Number(record.revision) || 1;
  if (knownRevision === revision) return { unchanged: true, revision };
  const messages = await readMessages(id);
  return { unchanged: false, conversation: { ...toSummary(record), messages } };
}

export async function markConversationRead(id: string, expectedRevision: number) {
  const result = await getChatRedis().eval<string[], number>(
    [
      'if redis.call("EXISTS", KEYS[1]) == 0 then return -1 end',
      'local revision = tonumber(redis.call("HGET", KEYS[1], "revision") or "1")',
      'if revision ~= tonumber(ARGV[1]) then return 0 end',
      'if redis.call("HGET", KEYS[1], "unreadByStudio") ~= "true" then return 2 end',
      'redis.call("HSET", KEYS[1], "unreadByStudio", "false")',
      'redis.call("HINCRBY", KEYS[1], "revision", 1)',
      'redis.call("INCR", KEYS[2])',
      'return 1',
    ].join('\n'),
    [conversationKey(id), INBOX_VERSION_KEY],
    [String(expectedRevision)],
  );

  if (result === -1) return { status: 'missing' as const };
  if (result === 0) return { status: 'changed' as const };
  return {
    status: 'read' as const,
    revision: expectedRevision + (result === 1 ? 1 : 0),
  };
}

export async function setConversationStatus(id: string, status: ChatConversationStatus) {
  const client = getChatRedis();
  const now = new Date().toISOString();
  const ttl = status === 'closed'
    ? CLOSED_CONVERSATION_TTL_SECONDS
    : CONVERSATION_TTL_SECONDS;

  const result = await client.eval<string[], number>(
    [
      'if redis.call("EXISTS", KEYS[1]) == 0 then return -1 end',
      'if redis.call("HGET", KEYS[1], "status") == ARGV[1] then return 0 end',
      'redis.call("HSET", KEYS[1], "status", ARGV[1], "updatedAt", ARGV[2])',
      'redis.call("HINCRBY", KEYS[1], "revision", 1)',
      'redis.call("INCR", KEYS[3])',
      'redis.call("EXPIRE", KEYS[1], ARGV[3])',
      'redis.call("EXPIRE", KEYS[2], ARGV[3])',
      'return 1',
    ].join('\n'),
    [conversationKey(id), messagesKey(id), INBOX_VERSION_KEY],
    [status, now, String(ttl)],
  );
  return result !== -1;
}

export async function setStudioAvailability(available: boolean) {
  const value: StudioAvailability = {
    available,
    heartbeatAt: available ? new Date().toISOString() : null,
    leaseId: available ? randomBytes(24).toString('base64url') : null,
  };
  const client = getChatRedis();
  await client.set(AVAILABILITY_KEY, value, available
    ? { ex: Math.ceil(AVAILABILITY_FRESH_MS / 1_000) }
    : { ex: 30 * 24 * 60 * 60 });
  return value;
}

export async function renewStudioAvailability(leaseId: string) {
  const heartbeatAt = new Date().toISOString();
  const result = await getChatRedis().eval<string[], number>(
    [
      'local raw = redis.call("GET", KEYS[1])',
      'if not raw then return 0 end',
      'local state = cjson.decode(raw)',
      'if state.available ~= true or state.leaseId ~= ARGV[1] then return 0 end',
      'state.heartbeatAt = ARGV[2]',
      'redis.call("SET", KEYS[1], cjson.encode(state), "EX", ARGV[3])',
      'return 1',
    ].join('\n'),
    [AVAILABILITY_KEY],
    [leaseId, heartbeatAt, String(Math.ceil(AVAILABILITY_FRESH_MS / 1_000))],
  );

  return result === 1
    ? { available: true, heartbeatAt, leaseId } satisfies StudioAvailability
    : null;
}

export async function readStudioAvailability(): Promise<StudioAvailability> {
  const stored = await getChatRedis().get<StudioAvailability>(AVAILABILITY_KEY);
  if (!stored?.available || !stored.heartbeatAt) {
    return { available: false, heartbeatAt: null, leaseId: null };
  }

  const heartbeat = Date.parse(stored.heartbeatAt);
  if (!Number.isFinite(heartbeat) || Date.now() - heartbeat > AVAILABILITY_FRESH_MS) {
    return { available: false, heartbeatAt: null, leaseId: null };
  }

  return stored;
}
