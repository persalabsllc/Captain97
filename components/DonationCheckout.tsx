'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createDonationCheckout } from '@/app/donate/actions';

const suggestedAmounts = [25, 50, 100, 250] as const;

function CheckoutButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary donation-submit" type="submit" disabled={pending}>
      {pending ? 'Opening secure checkout…' : 'Continue to secure checkout'}
    </button>
  );
}

export default function DonationCheckout() {
  const [state, formAction] = useActionState(
    createDonationCheckout,
    { message: null },
  );
  const [selectedAmount, setSelectedAmount] = useState('50');

  return (
    <form className="donation-checkout" action={formAction}>
      <fieldset className="donation-fieldset">
        <legend>Choose a one-time contribution</legend>
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

        <div
          className={`donation-custom-field${selectedAmount === 'custom' ? ' is-active' : ''}`}
        >
          <label htmlFor="custom-donation-amount">Enter another amount</label>
          <div className="donation-custom-input">
            <span aria-hidden="true">$</span>
            <input
              id="custom-donation-amount"
              name="customAmount"
              type="number"
              min="5"
              max="5000"
              step="0.01"
              inputMode="decimal"
              placeholder="5.00–5,000.00"
              onFocus={() => setSelectedAmount('custom')}
              aria-describedby="donation-amount-help"
            />
          </div>
          <small id="donation-amount-help">Minimum $5. One-time contribution—no subscription.</small>
        </div>
      </fieldset>

      {state.message ? (
        <p className="donation-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <CheckoutButton />
      <p className="donation-security-note">
        Secure payment powered by Stripe. Available card and wallet options appear at checkout.
      </p>
    </form>
  );
}
