'use client';

import { FormEvent, useState } from 'react';
import Icon from '@/components/Icon';
import styles from './ContactForm.module.css';

type FormStatus =
  | { kind: 'idle'; message: '' }
  | { kind: 'success' | 'error'; message: string };

const contactReasons = [
  { value: 'music-request', label: 'Music request' },
  { value: 'general', label: 'General question or feedback' },
  { value: 'underwriting', label: 'Underwriting & advertising' },
  { value: 'announcement', label: 'Community announcement or PSA' },
  { value: 'calendar', label: "Captain's Calendar event" },
  { value: 'on-air', label: 'Show, contest, or on-air question' },
  { value: 'technical', label: 'Streaming or website help' },
  { value: 'support', label: 'Donate, volunteer, or support the station' },
  { value: 'partnership', label: 'Press or community partnership' },
  { value: 'other', label: 'Other' },
] as const;

export default function ContactForm() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<FormStatus>({ kind: 'idle', message: '' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setPending(true);
    setStatus({ kind: 'idle', message: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          reason: formData.get('reason'),
          message: formData.get('message'),
          company: formData.get('company'),
        }),
      });
      const result = await response.json() as { message?: string };

      if (!response.ok) {
        setStatus({
          kind: 'error',
          message: result.message ?? 'Your message could not be sent. Please try again.',
        });
        return;
      }

      form.reset();
      setStatus({
        kind: 'success',
        message: 'Your message is headed to the Captain. We’ll follow up using the email or phone number you provided.',
      });
    } catch {
      setStatus({
        kind: 'error',
        message: 'We could not reach the station inbox. Please check your connection and try again.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={`${styles.form} premium-card glow-frame`} onSubmit={handleSubmit}>
      <div className={styles.intro}>
        <span className={styles.icon} aria-hidden="true">
          <Icon name="mail" size={24} />
        </span>
        <div>
          <strong>Message the station</strong>
          <span>Delivered directly to kyle@captain97.com</span>
        </div>
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Reason for contacting</span>
          <select name="reason" defaultValue="" required>
            <option value="" disabled>Select a reason</option>
            {contactReasons.map((reason) => (
              <option value={reason.value} key={reason.value}>{reason.label}</option>
            ))}
          </select>
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>Full name</span>
            <input
              type="text"
              name="name"
              minLength={3}
              maxLength={100}
              autoComplete="name"
              placeholder="Your first and last name"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Phone number</span>
            <input
              type="tel"
              name="phone"
              maxLength={32}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(252) 555-0123"
              required
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>Email address</span>
          <input
            type="email"
            name="email"
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
          />
        </label>

        <label className={styles.field}>
          <span>Message</span>
          <textarea
            name="message"
            minLength={5}
            maxLength={4_000}
            rows={7}
            placeholder="Tell us what’s on your mind. For a music request, include the song and artist if you know them."
            required
          />
        </label>
      </div>

      <label className={styles.honeypot} aria-hidden="true">
        Company
        <input name="company" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <div className={styles.footer}>
        <p>Your contact information and message are sent privately to Captain 97 and are never posted publicly.</p>
        <button className="btn btn-primary btn-shimmer" type="submit" disabled={pending}>
          <Icon name="send" size={18} />
          {pending ? 'Sending message…' : 'Send message'}
        </button>
      </div>

      {status.kind !== 'idle' ? (
        <div
          className={`${styles.status} ${status.kind === 'success' ? styles.success : styles.error}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span aria-hidden="true">
            <Icon name={status.kind === 'success' ? 'check' : 'close'} size={18} />
          </span>
          {status.message}
        </div>
      ) : null}
    </form>
  );
}
