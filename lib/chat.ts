export const CHAT_NAME_MAX_LENGTH = 80;
export const CHAT_EMAIL_MAX_LENGTH = 254;
export const CHAT_MESSAGE_MAX_LENGTH = 1_200;
export const CHAT_REPLY_NAME_MAX_LENGTH = 60;

export type ChatSender = 'listener' | 'studio';
export type ChatConversationStatus = 'open' | 'closed';

export type ChatMessage = {
  readonly id: string;
  readonly sender: ChatSender;
  readonly body: string;
  readonly createdAt: string;
  readonly displayName: string;
};

export type PublicChatConversation = {
  readonly id: string;
  readonly name: string;
  readonly status: ChatConversationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages: readonly ChatMessage[];
};

export type StudioConversationSummary = {
  readonly id: string;
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

export type StudioChatConversation = StudioConversationSummary & {
  readonly messages: readonly ChatMessage[];
};

export type StudioAvailability = {
  readonly available: boolean;
  readonly heartbeatAt: string | null;
  readonly leaseId?: string | null;
};

export type PublicChatStatus = {
  readonly available: boolean;
  readonly hostName: string | null;
  readonly showName: string;
};

type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

function valueAsString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function cleanSingleLine(value: unknown, maxLength: number) {
  return valueAsString(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function cleanChatMessage(value: unknown) {
  return valueAsString(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, CHAT_MESSAGE_MAX_LENGTH);
}

export function parseConversationCreateInput(body: unknown): Parsed<{
  name: string;
  email: string;
  message: string;
  trapped: boolean;
}> {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Please complete the form and try again.' };
  }

  const input = body as Record<string, unknown>;
  const name = cleanSingleLine(input.name, CHAT_NAME_MAX_LENGTH);
  const email = cleanSingleLine(input.email, CHAT_EMAIL_MAX_LENGTH).toLowerCase();
  const message = cleanChatMessage(input.message);
  const trapped = cleanSingleLine(input.company, 120).length > 0;

  if (name.length < 2) {
    return { ok: false, message: 'Please enter your name.' };
  }

  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }

  if (!message) {
    return { ok: false, message: 'Please enter a message for the studio.' };
  }

  return { ok: true, value: { name, email, message, trapped } };
}

export function parseMessageInput(body: unknown): Parsed<{ message: string }> {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Please enter a message.' };
  }

  const message = cleanChatMessage((body as Record<string, unknown>).message);
  return message
    ? { ok: true, value: { message } }
    : { ok: false, message: 'Please enter a message.' };
}

export function parseStudioReplyInput(body: unknown): Parsed<{
  message: string;
  displayName: string;
}> {
  const parsedMessage = parseMessageInput(body);
  if (!parsedMessage.ok) return parsedMessage;

  const input = body as Record<string, unknown>;
  const displayName = cleanSingleLine(input.displayName, CHAT_REPLY_NAME_MAX_LENGTH)
    || 'Captain 97 Studio';

  return {
    ok: true,
    value: { message: parsedMessage.value.message, displayName },
  };
}

export function parseStudioLoginInput(body: unknown): Parsed<{
  username: string;
  password: string;
}> {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Enter the studio username and password.' };
  }

  const input = body as Record<string, unknown>;
  const username = cleanSingleLine(input.username, 80).toLowerCase();
  const password = valueAsString(input.password).slice(0, 256);

  if (!username || !password) {
    return { ok: false, message: 'Enter the studio username and password.' };
  }

  return { ok: true, value: { username, password } };
}

export function parsePasswordChangeInput(body: unknown): Parsed<{
  currentPassword: string;
  newPassword: string;
}> {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Complete both password fields.' };
  }

  const input = body as Record<string, unknown>;
  const currentPassword = valueAsString(input.currentPassword).slice(0, 256);
  const newPassword = valueAsString(input.newPassword).slice(0, 256);

  if (!currentPassword || !newPassword) {
    return { ok: false, message: 'Complete both password fields.' };
  }

  if (newPassword.length < 14) {
    return { ok: false, message: 'Use at least 14 characters for the new password.' };
  }

  return { ok: true, value: { currentPassword, newPassword } };
}

export function chatPreview(message: string) {
  return message.replace(/\s+/g, ' ').trim().slice(0, 140);
}
