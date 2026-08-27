import Stripe from 'stripe';

let stripe: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  stripe ??= new Stripe(secretKey, {
    appInfo: {
      name: 'Captain 97.1 Donations',
      url: 'https://captain97.com/donate',
    },
  });

  return stripe;
}
