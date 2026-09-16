'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import BrandMark from '../BrandMark';
import { defaults, offers, stages, type Dashboard, type Email, type Offer, type Prospect, type Settings } from '@/lib/outreach/types';
import './outreach.css';
type Tab = 'Overview' | 'Prospects' | 'Emails' | 'Campaigns';
type Execute = (data: Record<string, unknown>) => Promise<boolean>;
const stamp = (date?: string) => date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(date)) : '—';
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
function Badge({ value }: { value: string }) { return <span className={`crm-badge crm-${value}`}>{value === 'uncertain' ? 'Check delivery' : value.replaceAll('-', ' ')}</span>; }
function Download({ data }: { data: Dashboard }) {
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `captain97-outreach-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  return <button className="crm-quiet" onClick={download}>Export CRM</button>;
}
export default function OutreachCRM() {
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading');
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null); const [newProspect, setNewProspect] = useState(false);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all'); const [emailFilter, setEmailFilter] = useState('all');
  const [category, setCategory] = useState('restaurants');
  const refresh = useCallback(async () => {
    const response = await fetch('/api/outreach', { cache: 'no-store' });
    if (response.status === 401) { setAuth('out'); setData(null); return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not load the CRM.');
    setData(result); setAuth('in');
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/outreach', { cache: 'no-store' }).then(async response => {
      if (response.status === 401) { if (active) setAuth('out'); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not load the CRM.');
      if (active) { setData(result); setAuth('in'); }
    }).catch(e => { if (active) { setError(e.message); setAuth('out'); } });
    return () => { active = false; };
  }, []);
  const execute: Execute = async (body) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (response.status === 401) setAuth('out');
      if (!response.ok) throw new Error(result.message || 'This action could not be completed.');
      setNotice(result.message); await refresh(); return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); return false; }
    finally { setBusy(false); }
  };
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      const response = await fetch('/api/studio/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); } finally { setBusy(false); }
  }
  async function logout() { setBusy(true); try { const r = await fetch('/api/studio/session', { method: 'DELETE' }); if (!r.ok) throw new Error('Could not sign out.'); setData(null); setAuth('out'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  if (auth !== 'in' || !data) return <main id="main-content" className="crm-login crm">
    <div className="crm-login-card"><BrandMark /><p className="crm-kicker">CAPTAIN 97.1 · STAFF ACCESS</p><h1>Grow your local<br />connections.</h1><p>Sign in to manage prospects, campaigns, and outgoing emails.</p>
      {error && <p className="crm-alert error" role="alert">{error}</p>}
      {auth === 'loading' ? <p role="status">Opening the outreach CRM…</p> : <form onSubmit={login}><label>Username<input name="username" defaultValue="studio" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="crm-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to outreach'}</button><small>Use your existing studio login.</small></form>}
      <Link href="/">Back to Captain 97.1</Link>
    </div><div className="crm-login-side"><p>LOCAL RADIO.<br />LOCAL RELATIONSHIPS.</p><span>Radio campaigns · Remote broadcasts · Sponsorships</span></div>
  </main>;
  const prospects = data.prospects.filter(p => (filter === 'all' || p.stage === filter) && `${p.business} ${p.contact} ${p.email} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
  const selectedProspect = data.prospects.find(p => p.id === selected);
  const queued = data.emails.filter(e => e.status === 'queued').length;
  const drafts = data.emails.filter(e => e.status === 'draft').length;
  const sent = data.emails.filter(e => e.status === 'sent').length;
  const due = data.prospects.filter(p => p.nextFollowUp && p.nextFollowUp <= new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) && !['closed', 'won', 'unsubscribed'].includes(p.stage));
  const value = data.prospects.filter(p => ['meeting', 'proposal'].includes(p.stage)).reduce((n, p) => n + p.value, 0);
  function openProspect(id: string) { setSelected(id); setNewProspect(false); setTab('Prospects'); }
  return <div className="crm crm-app">
    <aside className="crm-sidebar"><BrandMark /><div className="crm-sidebar-caption">OUTREACH DESK</div><nav aria-label="Outreach navigation">{(['Overview', 'Prospects', 'Emails', 'Campaigns'] as Tab[]).map((item, i) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setError(''); setNotice(''); }}><span aria-hidden="true">{['◫', '◎', '✉', '⚑'][i]}</span>{item}{item === 'Emails' && queued + drafts > 0 && <b>{queued + drafts}</b>}</button>)}</nav><div className="crm-sidebar-bottom"><p>New Bern, North Carolina</p><Link href="/studio">Studio inbox ↗</Link><Link href="/">Station website ↗</Link><button onClick={logout} disabled={busy}>Sign out</button></div></aside>
    <main id="main-content" className="crm-main"><header className="crm-topbar"><span>Captain 97.1 / {tab}</span><div><span className={`crm-run-state ${data.settings.enabled ? 'running' : ''}`}>{data.settings.enabled ? 'Automation active' : 'Automation paused'}</span>{data.settings.enabled && <button onClick={() => execute({ action: 'pause' })} disabled={busy}>Pause</button>}<button className="crm-mobile-signout" onClick={logout} disabled={busy}>Sign out</button><button onClick={() => { setError(''); refresh().catch(e => setError(e.message)); }} disabled={busy}>Refresh</button></div></header>
      <div className="crm-content"><div className="crm-heading"><div><p className="crm-kicker">YOUR LOCAL SALES WORKSPACE</p><h1>{tab === 'Overview' ? 'Make the next connection.' : tab}</h1><p>{tab === 'Overview' ? 'A clear view of your outreach, conversations, and opportunities.' : tab === 'Prospects' ? 'Find New Bern businesses and move each conversation forward.' : tab === 'Emails' ? 'Review drafts, manage your queue, and see exactly what was sent.' : 'Set your message, sending pace, and prospect discovery preferences.'}</p></div>{tab !== 'Campaigns' && <button className="crm-primary" disabled={busy} onClick={() => { setTab('Prospects'); setNewProspect(true); setSelected(null); }}>+ Add prospect</button>}</div>
        <div aria-live="polite">{notice && <p className="crm-alert success">{notice}</p>}{busy && <p className="crm-alert">Working… Prospect research can take about a minute.</p>}</div>{error && <p className="crm-alert error" role="alert">{error}</p>}
        {tab === 'Overview' && <>
          <section className="crm-metrics" aria-label="Outreach totals">{[['Prospects', data.prospects.length, 'Businesses in your CRM'], ['Sent today', `${data.todayCount} / ${data.settings.dailyLimit}`, 'Includes reserved send attempts'], ['Ready in queue', queued, `${drafts} drafts to review`], ['Open opportunities', money(value), 'Meeting and proposal value']].map(([label, number, detail]) => <article key={label}><span>{label}</span><strong>{number}</strong><small>{detail}</small></article>)}</section>
          <div className="crm-overview-grid"><section className="crm-panel"><div className="crm-panel-heading"><h2>Follow-ups to make</h2><span>{due.length} due</span></div>{due.length ? due.map(p => <button className="crm-follow-row" key={p.id} onClick={() => openProspect(p.id)}><div><strong>{p.business}</strong><small>{offers[p.offer]} · {p.nextFollowUp}</small></div><Badge value={p.stage} /></button>) : <div className="crm-empty"><span aria-hidden="true">◎</span><h3>{data.prospects.length ? 'You’re caught up.' : 'Your next advertiser starts here.'}</h3><p>{data.prospects.length ? 'Set a follow-up date on any prospect to keep the conversation moving.' : 'Find local businesses or add a contact you already know. Their notes and email history stay together.'}</p><button onClick={() => setTab('Prospects')}>Open prospects →</button></div>}</section>
          <section className="crm-panel crm-send-panel"><p className="crm-kicker">CAMPAIGN STATUS</p><h2>{data.settings.enabled ? 'Outreach is running.' : 'Ready when you are.'}</h2><p>Automatic emails send Monday–Friday, 9 a.m.–5 p.m. Eastern, with one message per scheduled run.</p><dl><div><dt>Email connection</dt><dd>{data.connections.email ? 'Connected' : 'Needs setup'}</dd></div><div><dt>Scheduled sending</dt><dd>{data.connections.scheduler ? 'Connected' : 'Needs setup'}</dd></div><div><dt>Last scheduled run</dt><dd>{stamp(data.lastRun)}</dd></div><div><dt>Total sent</dt><dd>{sent}</dd></div></dl><button className="crm-primary" onClick={() => setTab('Campaigns')}>Manage campaigns</button>{data.lastResult && <small>{data.lastResult}</small>}</section></div>
          <section className="crm-panel"><div className="crm-panel-heading"><h2>Recent outreach</h2><button onClick={() => setTab('Emails')}>View all emails →</button></div>{data.emails.length ? data.emails.slice(0, 5).map(e => <button className="crm-follow-row" key={e.id} onClick={() => setTab('Emails')}><div><strong>{data.prospects.find(p => p.id === e.prospectId)?.business || e.to}</strong><small>{e.subject}</small></div><Badge value={e.status} /></button>) : <p className="crm-muted crm-pad">Your drafts and sent messages will appear here.</p>}</section>
        </>}
        {tab === 'Prospects' && <>
          <section className="crm-discover"><div><h2>Find your next local partner</h2><p>Search the Chamber directory, then check business websites for published emails.</p></div><form onSubmit={e => { e.preventDefault(); execute({ action: 'discover', category }); }}><label className="crm-sr" htmlFor="research-category">Business category</label><select id="research-category" value={category} onChange={e => setCategory(e.target.value)}>{['restaurants', 'retail', 'home', 'health', 'automotive', 'marina', 'real estate', 'personal services', 'lodging'].map(c => <option key={c}>{c}</option>)}</select><button className="crm-primary" disabled={busy}>Find prospects</button></form></section>
          <div className="crm-toolbar"><label className="crm-search">Search prospects<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Business, contact, or email" /></label><label>Stage<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All stages</option>{stages.map(s => <option key={s}>{s}</option>)}</select></label><Download data={data} /></div>
          <div className={`crm-prospect-layout ${selectedProspect || newProspect ? 'with-editor' : ''}`}><section className="crm-panel crm-prospect-list"><div className="crm-panel-heading"><h2>Business pipeline</h2><span>{prospects.length} prospects</span></div>{prospects.length ? prospects.map(p => <button className={`crm-prospect-row ${p.id === selected ? 'selected' : ''}`} key={p.id} onClick={() => { setSelected(p.id); setNewProspect(false); }}><div className="crm-avatar" aria-hidden="true">{p.business.slice(0, 1).toUpperCase()}</div><div><strong>{p.business}</strong><small>{p.category || offers[p.offer]} · {p.city}</small><span>{p.email || 'Needs a published email'}</span></div><Badge value={p.stage} /></button>) : <div className="crm-empty"><h3>{query || filter !== 'all' ? 'No matching prospects.' : 'Start with a local business.'}</h3><p>Use Find prospects above, or add someone you already know.</p></div>}</section>
            {(selectedProspect || newProspect) && <ProspectEditor key={`${selectedProspect?.id || 'new'}-${data.revision}`} prospect={selectedProspect} busy={busy} execute={execute} emails={data.emails.filter(e => e.prospectId === selectedProspect?.id)} close={() => { setSelected(null); setNewProspect(false); }} showEmails={() => setTab('Emails')} />}
          </div>
        </>}
        {tab === 'Emails' && <><div className="crm-toolbar"><div className="crm-filter-buttons" aria-label="Email status">{['all', 'draft', 'queued', 'sent', 'failed', 'uncertain', 'cancelled'].map(s => <button className={emailFilter === s ? 'active' : ''} onClick={() => setEmailFilter(s)} key={s}>{s === 'uncertain' ? 'Check delivery' : s}</button>)}</div></div><p className="crm-muted">“Sent” means Resend accepted the message. Replies arrive at {data.settings.replyTo}; record the reply on the prospect to stop queued outreach.</p><div className="crm-email-list">{data.emails.filter(e => emailFilter === 'all' || e.status === emailFilter).map(e => <EmailEditor key={`${e.id}-${data.revision}`} email={e} business={data.prospects.find(p => p.id === e.prospectId)?.business || e.to} execute={execute} busy={busy} openProspect={() => openProspect(e.prospectId)} />)}{!data.emails.some(e => emailFilter === 'all' || e.status === emailFilter) && <div className="crm-panel crm-empty"><h3>No emails here yet.</h3><p>Open a prospect with a verified email and choose Create email draft.</p><button onClick={() => setTab('Prospects')}>Open prospects →</button></div>}</div></>}
        {tab === 'Campaigns' && <CampaignEditor key={data.revision} settings={data.settings} connections={data.connections} execute={execute} busy={busy} />}
        <footer className="crm-footnote">Captain 97.1 · Outreach desk <span>All sending times are Eastern.</span></footer>
      </div>
    </main>
  </div>;
}
function ProspectEditor({ prospect, busy, execute, close, emails, showEmails }: { prospect?: Prospect; busy: boolean; execute: Execute; close: () => void; emails: Email[]; showEmails: () => void }) {
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    const done = await execute({ action: 'save-prospect', id: prospect?.id, ...Object.fromEntries(f), emailVerified: f.get('emailVerified') === 'on' });
    if (done && !prospect) close();
  }
  return <section className="crm-panel crm-editor"><div className="crm-panel-heading"><h2>{prospect ? 'Prospect details' : 'Add prospect'}</h2><button onClick={close} aria-label="Close prospect details">✕</button></div><form onSubmit={save}>
    <label>Business name<input name="business" defaultValue={prospect?.business} maxLength={200} required /></label><div className="crm-fields"><label>Contact name<input name="contact" defaultValue={prospect?.contact} /></label><label>Phone<input name="phone" type="tel" defaultValue={prospect?.phone} /></label></div>
    <label>Business email<input name="email" type="email" defaultValue={prospect?.email} /></label><label>Website<input name="website" type="url" placeholder="https://" defaultValue={prospect?.website} /></label><label>Email source URL<input name="source" type="url" placeholder="Page where this email is published" defaultValue={prospect?.source} /></label><label className="crm-check"><input name="emailVerified" type="checkbox" defaultChecked={prospect?.emailVerified} /><span>I verified this business email at the source above.</span></label>
    <div className="crm-fields"><label>Category<input name="category" defaultValue={prospect?.category} /></label><label>City<input name="city" defaultValue={prospect?.city || 'New Bern'} /></label><label>Opportunity<select name="offer" defaultValue={prospect?.offer || 'radio'}>{Object.entries(offers).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>Stage<select name="stage" defaultValue={prospect?.stage || 'new'}>{stages.map(s => <option key={s}>{s}</option>)}</select></label><label>Next follow-up<input name="nextFollowUp" type="date" defaultValue={prospect?.nextFollowUp} /></label><label>Opportunity value ($)<input name="value" type="number" min="0" max="1000000" step="0.01" defaultValue={prospect?.value || 0} /></label></div>
    <label>Notes and conversation history<textarea name="notes" rows={5} maxLength={8000} defaultValue={prospect?.notes} placeholder="Calls, replies, goals, or a next step…" /></label><button className="crm-primary" disabled={busy}>Save prospect</button>
  </form>{prospect && <div className="crm-prospect-actions"><button disabled={busy || !prospect.website} onClick={() => execute({ action: 'research', id: prospect.id })}>Find email on website</button><button disabled={busy} onClick={async () => { if (await execute({ action: 'draft', id: prospect.id })) showEmails(); }}>Create email draft</button>{prospect.source && <a href={prospect.source} target="_blank" rel="noreferrer">View contact source ↗</a>}<h3>Email history ({emails.length})</h3>{emails.map(e => <button key={e.id} onClick={showEmails}><strong>{e.subject}</strong><small>{stamp(e.sentAt || e.createdAt)} · {e.status}</small></button>)}</div>}</section>;
}
function EmailEditor({ email, business, execute, busy, openProspect }: { email: Email; business: string; execute: Execute; busy: boolean; openProspect: () => void }) {
  const [subject, setSubject] = useState(email.subject); const [body, setBody] = useState(email.body);
  const [scheduled, setScheduled] = useState(() => { const d = new Date(email.scheduledAt); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  const editable = ['draft', 'queued'].includes(email.status); const [confirm, setConfirm] = useState(false);
  const payload = { id: email.id, subject, body, scheduledAt: scheduled ? new Date(scheduled).toISOString() : '' };
  return <details className="crm-panel crm-email"><summary><div><strong>{business}</strong><span>{email.subject}</span><small>{email.to} · {stamp(email.sentAt || email.createdAt)}</small></div><Badge value={email.status} /><span aria-hidden="true">⌄</span></summary><div className="crm-email-body"><button className="crm-text-button" onClick={openProspect}>Open prospect →</button>{email.error && <p className="crm-alert error">{email.error}</p>}<label>Subject<input value={subject} onChange={e => setSubject(e.target.value)} readOnly={!editable} maxLength={180} /></label><label>Message<textarea rows={13} value={body} onChange={e => setBody(e.target.value)} readOnly={!editable} maxLength={8000} /></label><div className="crm-email-footer">Captain 97.1 · Business outreach<br />1423 South Glenburnie Road, Suite C, New Bern, NC 28562<br />An unsubscribe link is added automatically.</div>{email.providerId && <small>Resend message ID: {email.providerId}</small>}
    {editable && <><label>Send on or after (your device’s local time)<input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} /></label><div className="crm-actions"><button disabled={busy} onClick={() => execute({ action: 'save-email', ...payload })}>Save draft</button><button className="crm-primary" disabled={busy} onClick={() => execute({ action: 'queue', ...payload })}>Queue email</button><button disabled={busy} onClick={() => setConfirm(true)}>Send now</button><button className="crm-danger" disabled={busy} onClick={() => execute({ action: 'cancel', id: email.id })}>Cancel email</button></div>{confirm && <div className="crm-confirm"><p>Send this message now to <strong>{email.to}</strong>?</p><div className="crm-actions"><button className="crm-primary" disabled={busy} onClick={async () => { if (await execute({ action: 'save-email', ...payload })) { await execute({ action: 'send', id: email.id }); } setConfirm(false); }}>Send this email</button><button onClick={() => setConfirm(false)}>Keep editing</button></div></div>}</>}
  </div></details>;
}
function CampaignEditor({ settings, connections, execute, busy }: { settings: Settings; connections: Dashboard['connections']; execute: Execute; busy: boolean }) {
  const [form, setForm] = useState<Settings>(structuredClone(settings)); const [offer, setOffer] = useState<Offer>('radio');
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm(s => ({ ...s, [key]: value }));
  return <form onSubmit={e => { e.preventDefault(); execute({ action: 'settings', ...form }); }} className="crm-campaign-grid"><section className="crm-panel crm-settings"><h2>Sending & discovery</h2><p className="crm-muted">Use the switches to choose how much runs automatically.</p>
    {!connections.scheduler && <p className="crm-alert">Scheduled sending needs the CRON_SECRET setting in Vercel. Manual sending and prospect research are available once email is connected.</p>}
    <label className="crm-check"><input type="checkbox" checked={form.enabled} onChange={e => update('enabled', e.target.checked)} /><span><strong>Run outreach automatically</strong><small>Send queued emails every 15 minutes, weekdays 9–5 Eastern.</small></span></label>
    <label className="crm-check"><input type="checkbox" checked={form.autoDiscover} onChange={e => update('autoDiscover', e.target.checked)} /><span><strong>Find new prospects automatically</strong><small>Research up to four businesses hourly while outreach is running.</small></span></label>
    <label className="crm-check"><input type="checkbox" checked={form.autoQueue} onChange={e => update('autoQueue', e.target.checked)} /><span><strong>Queue newly discovered contacts</strong><small>Use the selected campaign when a published email is found. Leave off to review drafts first.</small></span></label>
    <div className="crm-fields"><label>Daily email limit<input type="number" min={1} max={50} value={form.dailyLimit} onChange={e => update('dailyLimit', Number(e.target.value))} required /></label><label>Research category<select value={form.category} onChange={e => update('category', e.target.value)}>{['restaurants', 'retail', 'home', 'health', 'automotive', 'marina', 'real estate', 'personal services', 'lodging'].map(c => <option key={c}>{c}</option>)}</select></label></div>
    <label>Campaign for discovered prospects<select value={form.defaultOffer} onChange={e => update('defaultOffer', e.target.value as Offer)}>{Object.entries(offers).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>Send as<input value={form.from} onChange={e => update('from', e.target.value)} required /></label><label>Replies go to<input type="email" value={form.replyTo} onChange={e => update('replyTo', e.target.value)} required /></label><p className="crm-muted">Replies arrive in your mailbox. Mark a prospect as replied to stop their queued emails. Follow-up dates are reminders; follow-up emails are created by you.</p></section>
    <section className="crm-panel crm-settings"><div className="crm-panel-heading"><h2>Your campaign message</h2></div><label>Campaign<select value={offer} onChange={e => setOffer(e.target.value as Offer)}>{Object.entries(offers).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><p className="crm-muted">Personalize with {'{{business}}'}, {'{{contact}}'}, and {'{{city}}'}. A missing contact name uses “Business name team.”</p><label>Subject<input maxLength={180} value={form.templates[offer].subject} onChange={e => update('templates', { ...form.templates, [offer]: { ...form.templates[offer], subject: e.target.value } })} required /></label><label>Message<textarea rows={17} maxLength={8000} value={form.templates[offer].body} onChange={e => update('templates', { ...form.templates, [offer]: { ...form.templates[offer], body: e.target.value } })} required /></label><button type="button" onClick={() => update('templates', { ...form.templates, [offer]: { ...defaults.templates[offer] } })}>Restore this template</button><small>Changes apply to new drafts. Existing drafts keep their saved text.</small></section><div className="crm-save-bar"><span>{form.enabled ? 'Automatic sending will be active after saving.' : 'Automatic sending will stay paused.'}</span><button className="crm-primary" disabled={busy}>Save campaign settings</button></div></form>;
}
