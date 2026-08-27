'use client';

import { FormEvent, useEffect, useState } from 'react';

const suggestedAmounts = [25, 50, 100, 250] as const;

export default function DonationCheckout() {
  const [selectedAmount, setSelectedAmount] = useState('50');
  const [frequency, setFrequency] = useState<'monthly' | 'one_time'>('monthly');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const resetAfterHistoryNavigation = () => setPending(false);
    window.addEventListener('pageshow', resetAfterHistoryNavigation);
    return () => window.removeEventListener('pageshow', resetAfterHistoryNavigation);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/donate-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: formData.get('amount'),
          customAmount: formData.get('customAmount'),
          frequency: formData.get('frequency'),
        }),
      });
      const result = await response.json() as { message?: string; url?: string };

      if (!response.ok || !result.url) {
        setMessage(result.message ?? 'Secure checkout is temporarily unavailable. Please try again.');
        setPending(false);
        return;
      }

      window.location.assign(result.url);
    } catch {
      setMessage('Secure checkout is temporarily unavailable. Please check your connection and try again.');
      setPending(false);
    }
  }

  return (
    <form className="donation-checkout" onSubmit={handleSubmit}>
      <fieldset className="donation-fieldset donation-frequency-fieldset">
        <legend>Choose how you’d like to give</legend>
        <div className="donation-frequency-options">
          <label className="donation-frequency-option">
            <input
              type="radio"
              name="frequency"
              value="monthly"
              checked={frequency === 'monthly'}
              onChange={() => setFrequency('monthly')}
            />
            <span>
              <strong>Monthly</strong>
              <small>Keep us on the air every month</small>
            </span>
          </label>
          <label className="donation-frequency-option">
            <input
              type="radio"
              name="frequency"
              value="one_time"
              checked={frequency === 'one_time'}
              onChange={() => setFrequency('one_time')}
            />
            <span>
              <strong>One time</strong>
              <small>Make a single contribution</small>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="donation-fieldset">
        <legend>Choose your {frequency === 'monthly' ? 'monthly' : 'one-time'} amount</legend>
        <div className="donation-amount-grid">
          {suggestedAmounts.map((amount) => {
            const value = String(amount);

            return (
              <label className="donation-amount-option" key={amount}>
                <input
                  type="radio"
                  name="amount"
                  value={value}
                  checked={selectedAmount === value}
                  onChange={() => setSelectedAmount(value)}
                />
                <span>${amount}</span>
              </label>
            );
          })}

          <label className="donation-amount-option donation-amount-custom">
            <input
              type="radio"
              name="amount"
              value="custom"
              checked={selectedAmount === 'custom'}
              onChange={() => setSelectedAmount('custom')}
            />
            <span>Other amount</span>
          </label>
        </div>

        {selectedAmount === 'custom' ? (
          <div className="donation-custom-field is-active">
            <label htmlFor="custom-donation-amount">Enter another amount</label>
            <div className="donation-custom-input">
              <span aria-hidden="true">$</span>
              <input
                id="custom-donation-amount"
                name="customAmount"
                type="number"
                min="5"
                max="5000"
                step="1"
                inputMode="numeric"
                placeholder="5–5,000"
                required
                autoFocus
                aria-describedby="donation-amount-help"
              />
            </div>
            <small id="donation-amount-help">
              Minimum $5. {frequency === 'monthly'
                ? 'Renews automatically each month until canceled.'
                : 'This is a single contribution with no recurring charge.'}
            </small>
          </div>
        ) : null}
      </fieldset>

      {message ? (
        <p className="donation-error" role="alert">
          {message}
        </p>
      ) : null}

      <button className="btn btn-primary donation-submit" type="submit" disabled={pending}>
        {pending
          ? 'Opening secure checkout…'
          : frequency === 'monthly'
            ? 'Start monthly support'
            : 'Continue with one-time donation'}
      </button>
      <p className="donation-security-note">
        {frequency === 'monthly'
          ? 'Monthly donations renew automatically until canceled. Secure payment powered by Stripe.'
          : 'One secure payment powered by Stripe. No recurring charge.'}
      </p>
    </form>
  );
}
