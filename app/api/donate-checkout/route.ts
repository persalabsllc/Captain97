import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { siteConfig } from '@/lib/site';

const MIN_DONATION_CENTS = 500;
const MAX_DONATION_CENTS = 500_000;
const SUGGESTED_DONATIONS = new Set(['25', '50', '100', '250']);
const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_WINDOW_SECONDS = 10 * 60;

type DonationFrequency = 'monthly' | 'one_time';

type DonationCheckoutRequest = {
  amount?: unknown;
  customAmount?: unknown;
  frequency?: unknown;
};

function parseDonationAmount(value: unknown) {
  if (typeof value !== 'string') return null;

  const amount = value.trim();
  if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(amount)) return null;

  const [wholeDollars, fractionalDollars = ''] = amount.split('.');
  const cents = Number(wholeDollars) * 100 + Number(fractionalDollars.padEnd(2, '0'));

  if (cents < MIN_DONATION_CENTS || cents > MAX_DONATION_CENTS) return null;
  return cents;
}

function getCheckoutBaseUrl() {
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  return siteConfig.siteUrl;
}

async function checkoutRateLimitExceeded(request: Request) {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) return false;

  try {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const requestIdentifier = forwardedFor ?? request.headers.get('x-real-ip');

    if (!requestIdentifier) return false;

    const identifierHash = createHash('sha256').update(requestIdentifier).digest('hex').slice(0, 24);
    const key = `captain97:donation-checkout:${identifierHash}`;
    const redis = new Redis({ url, token });
    const attempts = await redis.eval<string[], number>(
      [
        'local attempts = redis.call("INCR", KEYS[1])',
        'if attempts == 1 then',
        '  redis.call("EXPIRE", KEYS[1], ARGV[1])',
        'end',
        'return attempts',
      ].join('\n'),
      [key],
      [String(CHECKOUT_RATE_WINDOW_SECONDS)],
    );

    return attempts > CHECKOUT_RATE_LIMIT;
  } catch (error) {
    console.warn('Donation checkout rate limit unavailable.', error);
    return false;
  }
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return errorResponse('This checkout request could not be verified.', 403);
  }

  let body: DonationCheckoutRequest;

  try {
    body = await request.json() as DonationCheckoutRequest;
  } catch {
    return errorResponse('Please choose a donation amount and try again.');
  }

  const selectedAmount = body.amount;
  const rawAmount = selectedAmount === 'custom' ? body.customAmount : selectedAmount;
  const amountInCents = parseDonationAmount(rawAmount);
  const frequency: DonationFrequency | null =
    body.frequency === 'monthly' || body.frequency === 'one_time' ? body.frequency : null;

  if (amountInCents === null) {
    return errorResponse('Please choose an amount between $5 and $5,000.');
  }

  if (!frequency) {
    return errorResponse('Please choose monthly or one-time support.');
  }

  if (await checkoutRateLimitExceeded(request)) {
    return errorResponse('Please wait a few minutes before starting another checkout.', 429);
  }

  const isMonthly = frequency === 'monthly';
  const amountInDollars = (amountInCents / 100).toFixed(2);
  const selectedTier =
    typeof selectedAmount === 'string' && SUGGESTED_DONATIONS.has(selectedAmount)
      ? selectedAmount
      : 'custom';
  const baseUrl = getCheckoutBaseUrl();
  const metadata = {
    source: 'captain97_donate_page',
    station: 'WXNR-LP',
    amount: amountInDollars,
    tier: selectedTier,
    frequency,
  };

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: isMonthly ? 'subscription' : 'payment',
      submit_type: 'donate',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountInCents,
            ...(isMonthly ? { recurring: { interval: 'month' as const } } : {}),
            product_data: {
              name: isMonthly ? 'Monthly support for Captain 97.1' : 'Support Captain 97.1',
              description: isMonthly
                ? 'Monthly listener support for WXNR-LP local broadcasting and streaming, including Captain 97 supporter perks.'
                : 'One-time support for WXNR-LP local broadcasting and streaming, including Captain 97 supporter perks.',
            },
          },
        },
      ],
      custom_fields: [
        {
          key: 'shirt_size',
          label: {
            type: 'custom',
            custom: 'Captain 97 T-shirt size',
          },
          type: 'dropdown',
          dropdown: {
            options: [
              { label: 'Small', value: 'small' },
              { label: 'Medium', value: 'medium' },
              { label: 'Large', value: 'large' },
              { label: 'XL', value: 'xl' },
              { label: '2XL', value: '2xl' },
              { label: '3XL', value: '3xl' },
            ],
          },
          optional: false,
        },
      ],
      success_url: `${baseUrl}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/donate#donation-heading`,
      metadata,
      ...(isMonthly
        ? { subscription_data: { metadata } }
        : {
            payment_intent_data: {
              description: `Captain 97.1 listener support — $${amountInDollars}`,
              metadata,
            },
          }),
      custom_text: {
        submit: {
          message: isMonthly
            ? 'Your donation renews monthly until canceled. Contact Captain 97 at any time to change or cancel it. We will email you to arrange your complimentary T-shirt and studio invitation.'
            : 'Thank you for helping keep local radio on the air. Captain 97 will email you to arrange your complimentary T-shirt and studio invitation.',
        },
      },
    });

    if (!session.url) {
      return errorResponse('Secure checkout is temporarily unavailable. Please try again in a moment.', 503);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Unable to create Captain 97 donation checkout.', error);
    return errorResponse('Secure checkout is temporarily unavailable. Please try again in a moment.', 503);
  }
}
