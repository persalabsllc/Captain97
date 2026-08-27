'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type {
  PublicChatConversation,
  PublicChatStatus,
} from '@/lib/chat';
import Icon from './Icon';

type ConversationResponse = {
  conversation?: PublicChatConversation;
  accepted?: boolean;
  message?: string;
};

const defaultStatus: PublicChatStatus = {
  available: false,
  hostName: null,
  showName: 'Captain 97.1',
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function ListenerChat() {
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<PublicChatConversation | null>(null);
  const [status, setStatus] = useState<PublicChatStatus>(defaultStatus);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [reply, setReply] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationId = conversation?.id ?? null;
  const conversationOpen = conversation?.status === 'open';

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/status', { cache: 'no-store' });
      if (!response.ok) return;
      setStatus(await response.json() as PublicChatStatus);
    } catch {
      // Availability is a helpful signal; chat creation reports storage failures directly.
    }
  }, []);

  const refreshConversation = useCallback(async (silent = false) => {
    try {
      const response = await fetch('/api/chat/conversation', { cache: 'no-store' });
      if (response.status === 404) {
        setConversation(null);
        return;
      }
      const result = await response.json() as ConversationResponse;
      if (!response.ok || !result.conversation) {
        if (!silent) setError(result.message ?? 'The studio chat could not be loaded.');
        return;
      }
      setConversation(result.conversation);
      if (!silent) setError(null);
    } catch {
      if (!silent) setError('The studio chat could not be loaded. Please check your connection.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([refreshStatus(), refreshConversation()]).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshConversation, refreshStatus]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshStatus();
        if (conversationId) void refreshConversation(true);
      }
    };
    const statusTimer = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(statusTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [conversationId, refreshConversation, refreshStatus]);

  useEffect(() => {
    if (!conversationId || !conversationOpen) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshConversation(true);
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [conversationId, conversationOpen, refreshConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [conversation?.messages.length]);

  async function startConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/chat/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message: firstMessage,
          company: formData.get('company'),
        }),
      });
      const result = await response.json() as ConversationResponse;
      if (!response.ok || !result.conversation) {
        if (result.accepted) {
          setFirstMessage('');
          return;
        }
        setError(result.message ?? 'Your message could not be sent. Please try again.');
        return;
      }

      setConversation(result.conversation);
      setFirstMessage('');
    } catch {
      setError('Your message could not be sent. Please check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply.trim()) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      });
      const result = await response.json() as { message?: string | object };
      if (!response.ok) {
        setError(typeof result.message === 'string' ? result.message : 'Your message could not be sent.');
        return;
      }
      setReply('');
      await refreshConversation(true);
    } catch {
      setError('Your message could not be sent. Please check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function startNewConversation() {
    setPending(true);
    try {
      const response = await fetch('/api/chat/conversation', { method: 'DELETE' });
      if (!response.ok) {
        setError('This chat could not be forgotten on this device. Please try again.');
        return;
      }
      setConversation(null);
      setName('');
      setEmail('');
      setReply('');
      setError(null);
    } finally {
      setPending(false);
    }
  }

  const publicStatusCopy = status.available
    ? `${status.hostName ?? 'The Captain 97 crew'} is available now`
    : 'The studio is taking messages';

  if (loading) {
    return (
      <div className="listener-chat-card premium-card chat-loading" aria-live="polite">
        <span className="chat-loading-mark" aria-hidden="true" />
        <p>Opening a private line to the studio…</p>
      </div>
    );
  }

  return (
    <div className="listener-chat-card premium-card">
      <header className="listener-chat-header">
        <div className="chat-avatar" aria-hidden="true"><Icon name="microphone" size={24} /></div>
        <div>
          <span className="listener-chat-kicker">Private conversation</span>
          <strong>Captain 97 Studio</strong>
          <small className={status.available ? 'is-live' : ''}>
            <i className="chat-presence-dot" aria-hidden="true" />{publicStatusCopy}
          </small>
          {conversation ? (
            <button className="chat-forget-button" type="button" onClick={() => void startNewConversation()} disabled={pending}>
              Forget on this device
            </button>
          ) : null}
        </div>
      </header>

      {conversation ? (
        <>
          <div className="chat-message-list" aria-live="polite" aria-label="Conversation messages">
            <div className="chat-system-message">
              {status.available
                ? `You’re connected to ${status.hostName ?? 'the Captain 97 crew'}.`
                : 'Your message is in the studio inbox. Keep this page open for a live reply, or the crew can follow up using your email.'}
            </div>
            {conversation.messages.map((message) => (
              <article
                className={`chat-bubble-row ${message.sender === 'listener' ? 'is-listener' : 'is-studio'}`}
                key={message.id}
              >
                <div className="chat-bubble">
                  <span>{message.displayName}</span>
                  <p>{message.body}</p>
                  <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                </div>
              </article>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {conversation.status === 'open' ? (
            <form className="chat-composer" onSubmit={sendReply}>
              <label className="sr-only" htmlFor="listener-chat-reply">Message the studio</label>
              <textarea
                id="listener-chat-reply"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                maxLength={1_200}
                rows={2}
                placeholder="Write a message…"
                disabled={pending}
                required
              />
              <button type="submit" disabled={pending || !reply.trim()} aria-label="Send message">
                <Icon name="send" size={20} />
              </button>
            </form>
          ) : (
            <div className="chat-closed-notice">
              <p>This conversation has been closed by the studio.</p>
              <button className="btn btn-dark" type="button" onClick={() => void startNewConversation()} disabled={pending}>
                Start a new conversation
              </button>
            </div>
          )}
        </>
      ) : (
        <form className="listener-chat-start" onSubmit={startConversation}>
          <div className="chat-welcome-copy">
            <div className="eyebrow dark">Say hello</div>
            <h2>What’s on your mind?</h2>
            <p>This is a private one-on-one conversation with the Captain 97 studio—not a public chatroom.</p>
          </div>

          <div className="chat-form-grid">
            <label>
              <span>Your name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={80}
                autoComplete="name"
                placeholder="First name is fine"
                required
              />
            </label>
            <label>
              <span>Your email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                autoComplete="email"
                placeholder="So we can reply later"
                required
              />
            </label>
          </div>

          <label className="chat-message-field">
            <span>Your message</span>
            <textarea
              value={firstMessage}
              onChange={(event) => setFirstMessage(event.target.value)}
              maxLength={1_200}
              rows={5}
              placeholder="Send a note, request a song, or say hello to the DJ…"
              required
            />
          </label>

          <label className="chat-honeypot" aria-hidden="true">
            Company
            <input name="company" type="text" tabIndex={-1} autoComplete="off" />
          </label>

          <button className="btn btn-primary chat-start-button" type="submit" disabled={pending}>
            <Icon name="message" size={18} />
            {pending ? 'Opening your chat…' : 'Start private chat'}
          </button>
          <p className="chat-privacy-note">Your name, email, and messages are visible only to authorized Captain 97 studio staff.</p>
        </form>
      )}

      {error ? <p className="chat-error" role="alert">{error}</p> : null}
    </div>
  );
}
