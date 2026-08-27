'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  StudioAvailability,
  StudioChatConversation,
  StudioConversationSummary,
} from '@/lib/chat';
import BrandMark from './BrandMark';
import Icon from './Icon';

type AuthState = 'loading' | 'signed-out' | 'signed-in';

type InboxResponse = {
  conversations?: StudioConversationSummary[];
  availability?: StudioAvailability;
  unchanged?: boolean;
  version?: number;
  message?: string;
};

type ThreadResponse = {
  conversation?: StudioChatConversation;
  unchanged?: boolean;
  revision?: number;
  message?: string;
};

function formatInboxTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat('en-US', sameDay
    ? { hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' }).format(date);
}

function formatThreadTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function StudioPortal() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [username, setUsername] = useState('studio');
  const [password, setPassword] = useState('');
  const [conversations, setConversations] = useState<StudioConversationSummary[]>([]);
  const [availability, setAvailability] = useState<StudioAvailability>({
    available: false,
    heartbeatAt: null,
    leaseId: null,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<StudioChatConversation | null>(null);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyAs, setReplyAs] = useState('Captain 97 Studio');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const inboxVersionRef = useRef<number | null>(null);
  const lastFullInboxAtRef = useRef(0);
  const threadRevisionsRef = useRef<Record<string, number>>({});
  const inboxRequestRef = useRef(0);
  const threadRequestRef = useRef(0);
  const changePasswordButtonRef = useRef<HTMLButtonElement>(null);
  const passwordModalRef = useRef<HTMLElement>(null);

  const reply = selectedId ? drafts[selectedId] ?? '' : '';

  const handleUnauthorized = useCallback(() => {
    selectedIdRef.current = null;
    inboxVersionRef.current = null;
    threadRequestRef.current += 1;
    setAuthState('signed-out');
    setConversations([]);
    setSelectedId(null);
    setThread(null);
  }, []);

  const loadInbox = useCallback(async (silent = false) => {
    const requestId = ++inboxRequestRef.current;
    try {
      const canUseVersion = silent
        && Date.now() - lastFullInboxAtRef.current < 30 * 60 * 1_000;
      const knownVersion = canUseVersion ? inboxVersionRef.current : null;
      const endpoint = knownVersion === null
        ? '/api/studio/chat'
        : `/api/studio/chat?version=${knownVersion}`;
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const result = await response.json() as InboxResponse;
      if (requestId !== inboxRequestRef.current) return;
      if (!response.ok || !result.availability) {
        if (!silent) setError(result.message ?? 'The studio inbox could not be loaded.');
        return;
      }

      setAvailability(result.availability);
      if (typeof result.version === 'number') inboxVersionRef.current = result.version;
      if (result.unchanged) {
        if (!silent) setError(null);
        return;
      }
      if (!result.conversations) {
        if (!silent) setError('The studio inbox could not be loaded.');
        return;
      }

      lastFullInboxAtRef.current = Date.now();
      setConversations(result.conversations);
      const currentId = selectedIdRef.current;
      if (currentId && !result.conversations.some((conversation) => conversation.id === currentId)) {
        selectedIdRef.current = null;
        threadRequestRef.current += 1;
        setSelectedId(null);
        setThread(null);
      } else if (!currentId && window.matchMedia('(min-width: 761px)').matches) {
        const firstId = result.conversations[0]?.id ?? null;
        selectedIdRef.current = firstId;
        setSelectedId(firstId);
      }
      if (!silent) setError(null);
    } catch {
      if (!silent) setError('The studio inbox could not be loaded. Check the connection and try again.');
    }
  }, [handleUnauthorized]);

  const loadThread = useCallback(async (conversationId: string, silent = false) => {
    const requestId = ++threadRequestRef.current;
    try {
      const knownRevision = silent ? threadRevisionsRef.current[conversationId] : undefined;
      const query = typeof knownRevision === 'number' ? `?revision=${knownRevision}` : '';
      const response = await fetch(`/api/studio/chat/conversations/${encodeURIComponent(conversationId)}${query}`, {
        cache: 'no-store',
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const result = await response.json() as ThreadResponse;
      if (requestId !== threadRequestRef.current || selectedIdRef.current !== conversationId) return;
      if (response.status === 404) {
        selectedIdRef.current = null;
        threadRequestRef.current += 1;
        inboxVersionRef.current = null;
        setSelectedId(null);
        setThread(null);
        void loadInbox(true);
        return;
      }
      if (!response.ok || (!result.conversation && !result.unchanged)) {
        if (!silent) setError(result.message ?? 'This conversation could not be loaded.');
        return;
      }
      if (result.unchanged) return;
      if (!result.conversation) return;
      threadRevisionsRef.current[conversationId] = result.conversation.revision;
      setThread(result.conversation);
      if (!silent) setError(null);
    } catch {
      if (!silent && requestId === threadRequestRef.current && selectedIdRef.current === conversationId) {
        setError('This conversation could not be loaded.');
      }
    }
  }, [handleUnauthorized, loadInbox]);

  useEffect(() => {
    void fetch('/api/studio/session', { cache: 'no-store' })
      .then((response) => {
        const savedReplyAs = window.localStorage.getItem('captain97-studio-reply-as');
        if (savedReplyAs) setReplyAs(savedReplyAs);
        if (!response.ok) {
          setAuthState('signed-out');
          return;
        }
        setAuthState('signed-in');
        void loadInbox();
      })
      .catch(() => {
        setError('The studio inbox could not be reached.');
        setAuthState('signed-out');
      });
  }, [loadInbox]);

  useEffect(() => {
    if (authState !== 'signed-in' || !selectedId) return;
    const timer = window.setTimeout(() => void loadThread(selectedId), 0);
    return () => window.clearTimeout(timer);
  }, [authState, loadThread, selectedId]);

  useEffect(() => {
    if (authState !== 'signed-in') return;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void loadInbox(true);
      if (selectedId) void loadThread(selectedId, true);
    };
    const inboxTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadInbox(true);
    }, 8_000);
    const threadTimer = window.setInterval(() => {
      if (selectedId && document.visibilityState === 'visible') void loadThread(selectedId, true);
    }, 4_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(inboxTimer);
      window.clearInterval(threadTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [authState, loadInbox, loadThread, selectedId]);

  const updateAvailability = useCallback(async (
    available: boolean,
    silent = false,
    leaseId?: string,
  ) => {
    try {
      const response = await fetch('/api/studio/chat/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaseId
          ? { available, heartbeat: true, leaseId }
          : { available }),
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const result = await response.json() as { availability?: StudioAvailability; message?: string };
      if (result.availability) setAvailability(result.availability);
      if (!response.ok || !result.availability) {
        if (!silent) setError(result.message ?? 'The studio status could not be updated.');
        return;
      }
    } catch {
      if (!silent) setError('The studio status could not be updated.');
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    if (authState !== 'signed-in' || !availability.available || !availability.leaseId) return;
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void updateAvailability(true, true, availability.leaseId ?? undefined);
      }
    }, 60_000);
    return () => window.clearInterval(heartbeat);
  }, [authState, availability.available, availability.leaseId, updateAvailability]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [thread?.id, thread?.messages.length]);

  const closePasswordForm = useCallback((force = false) => {
    if (pending && !force) return;
    setShowPasswordForm(false);
    setPasswordError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    window.setTimeout(() => changePasswordButtonRef.current?.focus(), 0);
  }, [pending]);

  useEffect(() => {
    if (!showPasswordForm) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePasswordForm(false);
      if (event.key !== 'Tab') return;
      const focusable = passwordModalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [closePasswordForm, showPasswordForm]);

  useEffect(() => {
    if (authState !== 'signed-in') return;
    const unread = conversations.filter((conversation) => conversation.unreadByStudio).length;
    document.title = unread > 0 ? `(${unread}) DJ Inbox | Captain 97.1` : 'DJ Inbox | Captain 97.1';
    return () => { document.title = 'Captain 97.1'; };
  }, [authState, conversations]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      `${conversation.name} ${conversation.email} ${conversation.lastMessagePreview}`
        .toLowerCase()
        .includes(query));
  }, [conversations, search]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/studio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        setError(result.message ?? 'The studio sign-in was not accepted.');
        return;
      }
      setPassword('');
      setAuthState('signed-in');
      await loadInbox();
    } catch {
      setError('The studio inbox could not be reached.');
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    try {
      const response = await fetch('/api/studio/session', { method: 'DELETE' });
      if (!response.ok) {
        setError('Sign out could not be completed. Please try again.');
        return;
      }
      handleUnauthorized();
    } catch {
      setError('Sign out could not be completed. Please try again.');
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetId = selectedIdRef.current;
    const targetDraft = targetId ? drafts[targetId] ?? '' : '';
    const targetMessage = targetDraft.trim();
    if (!targetId || thread?.id !== targetId || !targetMessage) return;
    setPending(true);
    setError(null);
    window.localStorage.setItem('captain97-studio-reply-as', replyAs);
    try {
      const response = await fetch(`/api/studio/chat/conversations/${encodeURIComponent(targetId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: targetMessage, displayName: replyAs }),
      });
      const result = await response.json() as { message?: string | object };
      if (!response.ok) {
        setError(typeof result.message === 'string' ? result.message : 'The reply could not be sent.');
        return;
      }
      setDrafts((current) => current[targetId] === targetDraft
        ? { ...current, [targetId]: '' }
        : current);
      await Promise.all([loadThread(targetId, true), loadInbox(true)]);
    } catch {
      setError('The reply could not be sent. Check the connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function updateConversation(action: 'open' | 'closed') {
    const targetId = selectedIdRef.current;
    if (!targetId || thread?.id !== targetId) return;
    setPending(true);
    try {
      const response = await fetch(`/api/studio/chat/conversations/${encodeURIComponent(targetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const result = await response.json() as { message?: string };
        setError(result.message ?? 'The conversation could not be updated.');
        return;
      }
      await Promise.all([loadThread(targetId, true), loadInbox(true)]);
    } catch {
      setError('The conversation could not be updated. Check the connection and try again.');
    } finally {
      setPending(false);
    }
  }

  function selectConversation(conversation: StudioConversationSummary) {
    const changed = selectedIdRef.current !== conversation.id;
    selectedIdRef.current = conversation.id;
    if (changed) {
      threadRequestRef.current += 1;
      setThread(null);
      setSelectedId(conversation.id);
    }
  }

  async function markRead(conversationId: string, revision: number) {
    try {
      const response = await fetch(`/api/studio/chat/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', revision }),
      });
      const result = await response.json() as { revision?: number; message?: string };
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok || typeof result.revision !== 'number') {
        if (response.status === 409) {
          await Promise.all([loadThread(conversationId, true), loadInbox(true)]);
          return;
        }
        setError(result.message ?? 'The conversation could not be marked read.');
        return;
      }

      threadRevisionsRef.current[conversationId] = Math.max(
        threadRevisionsRef.current[conversationId] ?? 0,
        result.revision,
      );
      setConversations((current) => current.map((conversation) => (
        conversation.id === conversationId && conversation.revision <= revision
          ? { ...conversation, unreadByStudio: false, revision: result.revision as number }
          : conversation
      )));
      setThread((current) => current?.id === conversationId && current.revision <= revision
        ? { ...current, unreadByStudio: false, revision: result.revision as number }
        : current);
      inboxVersionRef.current = null;
      void loadInbox(true);
    } catch {
      setError('The conversation could not be marked read.');
    }
  }

  function returnToInbox() {
    selectedIdRef.current = null;
    threadRequestRef.current += 1;
    setSelectedId(null);
    setThread(null);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setPending(true);
    setPasswordError(null);
    try {
      const response = await fetch('/api/studio/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        setPasswordError(result.message ?? 'The password could not be changed.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      closePasswordForm(true);
    } catch {
      setPasswordError('The password could not be changed.');
    } finally {
      setPending(false);
    }
  }

  if (authState === 'loading') {
    return (
      <main id="main-content" className="studio-page studio-login-page">
        <div className="studio-login-card">
          <BrandMark tone="light" preload />
          <span className="studio-loader" aria-hidden="true" />
          <p>Opening the studio inbox…</p>
        </div>
      </main>
    );
  }

  if (authState === 'signed-out') {
    return (
      <main id="main-content" className="studio-page studio-login-page">
        <section className="studio-login-card" aria-labelledby="studio-login-heading">
          <BrandMark tone="light" preload />
          <div className="studio-login-lock" aria-hidden="true"><Icon name="lock" size={24} /></div>
          <span className="studio-kicker">Private station workspace</span>
          <h1 id="studio-login-heading">DJ Inbox</h1>
          <p>One shared account for the Captain 97 studio.</p>
          <form onSubmit={signIn}>
            <label>
              <span>Username</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? 'Signing in…' : 'Open studio inbox'}
            </button>
          </form>
          {error ? <p className="studio-error" role="alert">{error}</p> : null}
        </section>
      </main>
    );
  }

  const unreadCount = conversations.filter((conversation) => conversation.unreadByStudio).length;
  const encodedEmail = thread ? encodeURIComponent(thread.email) : '';
  const emailParameters = thread ? new URLSearchParams({
    subject: 'Following up on your Captain 97 DJ chat',
    body: `Hi ${thread.name},\n\nThanks for chatting with Captain 97.\n\n`,
  }).toString() : '';

  return (
    <main id="main-content" className={`studio-page studio-inbox-page${selectedId ? ' has-selected-thread' : ''}`}>
      <header className="studio-topbar" inert={showPasswordForm || undefined}>
        <BrandMark tone="light" preload />
        <div className="studio-topbar-status">
          <button
            className={`studio-availability${availability.available ? ' is-available' : ''}`}
            type="button"
            role="switch"
            aria-checked={availability.available}
            onClick={() => void updateAvailability(!availability.available)}
          >
            <span aria-hidden="true"><i /></span>
            <strong>{availability.available ? 'Available now' : 'Taking messages'}</strong>
          </button>
          <button
            ref={changePasswordButtonRef}
            className="studio-topbar-button studio-change-password"
            type="button"
            onClick={() => {
              setPasswordError(null);
              setShowPasswordForm(true);
            }}
          >
            <Icon name="lock" size={16} />Change password
          </button>
          <button className="studio-topbar-button" type="button" onClick={() => void signOut()}><Icon name="logout" size={16} />Sign out</button>
        </div>
      </header>

      <div className="studio-workspace" inert={showPasswordForm || undefined}>
        <aside className="studio-inbox-list" aria-label="Listener conversations">
          <div className="studio-inbox-heading">
            <div>
              <span className="studio-kicker">Shared studio account</span>
              <h1>DJ Inbox</h1>
            </div>
            {unreadCount ? <span className="studio-unread-total">{unreadCount} new</span> : null}
          </div>

          <label className="studio-search">
            <Icon name="search" size={17} />
            <span className="sr-only">Search conversations</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or message" />
          </label>

          <div className="studio-conversation-list">
            {filteredConversations.length ? filteredConversations.map((conversation) => (
              <button
                className={`studio-conversation-preview${selectedId === conversation.id ? ' is-selected' : ''}${conversation.unreadByStudio ? ' is-unread' : ''}`}
                type="button"
                key={conversation.id}
                aria-pressed={selectedId === conversation.id}
                onClick={() => selectConversation(conversation)}
              >
                <span className="studio-list-avatar">{conversation.name.slice(0, 1).toUpperCase()}</span>
                <span className="studio-list-copy">
                  <span><strong>{conversation.name}</strong><time>{formatInboxTime(conversation.lastMessageAt)}</time></span>
                  <small>{conversation.lastMessagePreview}</small>
                  <em>{conversation.status === 'closed' ? 'Closed' : conversation.email}</em>
                </span>
                {conversation.unreadByStudio ? <i className="studio-unread-dot" aria-label="Unread" /> : null}
              </button>
            )) : (
              <div className="studio-empty-list">
                <Icon name="inbox" size={30} />
                <strong>{search ? 'No conversations found' : 'The inbox is clear'}</strong>
                <p>{search ? 'Try another name or email.' : 'New listener messages will appear here.'}</p>
              </div>
            )}
          </div>
        </aside>

        <section className="studio-thread" aria-label="Selected conversation">
          {thread ? (
            <>
              <header className="studio-thread-header">
                <button className="studio-mobile-back" type="button" onClick={returnToInbox} aria-label="Back to inbox">←</button>
                <span className="studio-thread-avatar">{thread.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <h2>{thread.name}</h2>
                  <a href={`mailto:${encodedEmail}`}>{thread.email}</a>
                  {thread.hostAtStart ? <small>Started during {thread.hostAtStart}&apos;s show</small> : null}
                </div>
                <div className="studio-thread-actions">
                  <a className="studio-email-button" href={`mailto:${encodedEmail}?${emailParameters}`} title="Open in email" aria-label="Open in email">
                    <Icon name="mail" size={16} /><span>Open in email</span>
                  </a>
                  {thread.unreadByStudio ? (
                    <button
                      type="button"
                      onClick={() => void markRead(thread.id, thread.revision)}
                      disabled={pending}
                      title="Mark read"
                      aria-label="Mark conversation read"
                    >
                      <Icon name="check" size={16} /><span>Mark read</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void updateConversation(thread.status === 'open' ? 'closed' : 'open')}
                    disabled={pending}
                    aria-label={thread.status === 'open' ? 'Close conversation' : 'Reopen conversation'}
                  >
                    <Icon name={thread.status === 'open' ? 'close' : 'message'} size={16} />
                    <span>{thread.status === 'open' ? 'Close chat' : 'Reopen chat'}</span>
                  </button>
                </div>
              </header>

              <div className="studio-message-list" aria-live="polite">
                <div className="studio-thread-start">Conversation started {formatThreadTime(thread.createdAt)}</div>
                {thread.messages.map((message) => (
                  <article className={`studio-message-row ${message.sender === 'studio' ? 'is-studio' : 'is-listener'}`} key={message.id}>
                    <div className="studio-message-bubble">
                      <span>{message.displayName}</span>
                      <p>{message.body}</p>
                      <time dateTime={message.createdAt}>{formatThreadTime(message.createdAt)}</time>
                    </div>
                  </article>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {thread.status === 'open' ? (
                <form className="studio-composer" onSubmit={sendReply}>
                  <div className="studio-reply-as">
                    <label htmlFor="studio-reply-as">Replying as</label>
                    <input id="studio-reply-as" value={replyAs} onChange={(event) => setReplyAs(event.target.value)} maxLength={60} />
                  </div>
                  <div className="studio-reply-box">
                    <label className="sr-only" htmlFor="studio-reply">Reply to listener</label>
                    <textarea
                      id="studio-reply"
                      value={reply}
                      onChange={(event) => {
                        const conversationId = selectedIdRef.current;
                        if (!conversationId) return;
                        setDrafts((current) => ({ ...current, [conversationId]: event.target.value }));
                      }}
                      maxLength={1_200}
                      rows={3}
                      placeholder="Type a reply to the listener…"
                      disabled={pending}
                      required
                    />
                    <button type="submit" disabled={pending || !reply.trim() || thread.id !== selectedId}>
                      <Icon name="send" size={18} />{pending ? 'Sending…' : 'Send reply'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="studio-closed-composer">
                  <Icon name="check" size={19} />
                  <span>This conversation is closed.</span>
                  <button type="button" onClick={() => void updateConversation('open')}>Reopen to reply</button>
                </div>
              )}
            </>
          ) : (
            <div className="studio-thread-empty">
              <div><Icon name="message" size={35} /></div>
              <h2>Select a conversation</h2>
              <p>Choose a listener from the shared inbox to read and reply.</p>
            </div>
          )}
          {error ? <p className="studio-floating-error" role="alert">{error}</p> : null}
        </section>
      </div>

      {showPasswordForm ? (
        <div className="studio-modal-backdrop" role="presentation">
          <section ref={passwordModalRef} className="studio-password-modal" role="dialog" aria-modal="true" aria-labelledby="change-password-heading">
            <button className="studio-modal-close" type="button" onClick={() => closePasswordForm(false)} disabled={pending} aria-label="Close"><Icon name="close" size={20} /></button>
            <span className="studio-kicker">Shared account security</span>
            <h2 id="change-password-heading">Change studio password</h2>
            <p>This updates the one shared login and revokes every older studio session.</p>
            <form onSubmit={changePassword}>
              <label>
                <span>Current password</span>
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" autoFocus required />
              </label>
              <label>
                <span>New password</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={14} autoComplete="new-password" required />
                <small>Use at least 14 characters.</small>
              </label>
              <label>
                <span>Confirm new password</span>
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={14} autoComplete="new-password" required />
              </label>
              {passwordError ? <p className="studio-error" role="alert">{passwordError}</p> : null}
              <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Updating…' : 'Update shared password'}</button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
