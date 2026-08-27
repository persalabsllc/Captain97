import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import { getStripe } from '@/lib/stripe';

export const metadata: Metadata = {
  title: 'Thank You',
  description: 'Thank you for supporting Captain 97.1 and WXNR-LP local radio.',
  robots: { index: false, follow: false },
};

type DonationStatus = 'paid' | 'pending' | 'invalid' | 'unavailable';

type DonationThankYouPageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

async function getDonationStatus(sessionId: string | string[] | undefined): Promise<DonationStatus> {
  if (typeof sessionId !== 'string' || !/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return 'invalid';
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const belongsToCaptain97 =
      session.metadata?.source === 'captain97_donate_page' &&
      session.metadata.station === 'WXNR-LP';

    if (!belongsToCaptain97 || session.status !== 'complete') return 'invalid';
    return session.payment_status === 'paid' ? 'paid' : 'pending';
  } catch (error) {
    console.error('Unable to verify Captain 97 donation checkout.', error);
    return 'unavailable';
  }
}

const statusContent = {
  paid: {
    eyebrow: 'Payment complete',
    title: "We're grateful to have you aboard.",
    copy: 'Stripe will send your payment receipt by email, and Captain 97 will follow up to arrange your complimentary T-shirt and studio invitation. Thank you for supporting local radio in New Bern.',
  },
  pending: {
    eyebrow: 'Payment processing',
    title: 'Your support is being confirmed.',
    copy: 'Stripe is still confirming the payment. You will receive an email receipt when it is complete.',
  },
  invalid: {
    eyebrow: 'Checkout not confirmed',
    title: "Let's get you back on course.",
    copy: 'We could not confirm a completed contribution from this link. You can return to the support page and try again.',
  },
  unavailable: {
    eyebrow: 'Receipt check unavailable',
    title: 'Your checkout may still be complete.',
    copy: 'We could not reach Stripe to verify the payment just now. Check your email for a Stripe receipt before trying again.',
  },
} as const;

export default async function DonationThankYouPage({ searchParams }: DonationThankYouPageProps) {
  const { session_id: sessionId } = await searchParams;
  const status = await getDonationStatus(sessionId);
  const content = statusContent[status];

  return (
    <main id="main-content" className="inner-page page-donate">
      <PageHero
        eyebrow="Thank you"
        title="You keep the Captain moving"
        intro="Your support helps Captain 97.1 keep broadcasting, streaming and serving New Bern."
      />

      <section className="section donation-thank-you-section">
        <div className="container">
          <article className="donation-thank-you premium-panel">
            <div className="donation-heart" aria-hidden="true">♥</div>
            <div>
              <div className="eyebrow">{content.eyebrow}</div>
              <h2>{content.title}</h2>
              <p>{content.copy}</p>
              <div className="donation-actions">
                {status === 'paid' || status === 'pending' ? (
                  <>
                    <Link className="btn btn-light" href="/">
                      Return home
                    </Link>
                    <Link className="btn btn-ghost" href="/on-air">
                      Meet the crew
                    </Link>
                  </>
                ) : (
                  <>
                    <Link className="btn btn-light" href="/donate">
                      Return to support
                    </Link>
                    <Link className="btn btn-ghost" href="/contact#support-inquiry">
                      Contact the station
                    </Link>
                  </>
                )}
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
