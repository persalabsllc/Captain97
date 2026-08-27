import type { Metadata } from 'next';
import DonationCheckout from '@/components/DonationCheckout';
import PageHero from '@/components/PageHero';

export const metadata: Metadata = {
  title: 'Support Captain 97.1',
  description:
    "Help keep Captain 97.1 broadcasting and streaming Carolina's Dock Rock from New Bern, North Carolina.",
  alternates: { canonical: '/donate' },
};

const supportAreas = [
  ['Signal', 'Tower, transmitter and day-to-day broadcast expenses.'],
  ['Studio', 'Reliable equipment and the tools our local voices use on air.'],
  ['Stream', 'Online listening that carries Captain 97 beyond the FM signal.'],
  ['Community', 'A local platform for the people and happenings around New Bern.'],
];

export default function DonatePage() {
  return (
    <main id="main-content" className="inner-page page-donate">
      <PageHero
        eyebrow="Listener supported"
        title="Keep the Captain on the air"
        intro="Local radio takes a community. Your support helps WXNR-LP keep broadcasting, streaming and showing up for New Bern."
      />

      <section className="section donation-intro" aria-labelledby="donation-heading">
        <div className="container donation-layout">
          <article className="donation-primary premium-panel">
            <div className="donation-heart" aria-hidden="true">♥</div>
            <div>
              <div className="eyebrow">Support Captain 97</div>
              <h2 id="donation-heading">Every contribution keeps local radio moving.</h2>
              <p>
                Make a one-time contribution to support Captain 97.1&apos;s community radio
                programming and operating costs. Choose an amount below, then finish on
                Stripe&apos;s secure checkout.
              </p>
              <DonationCheckout />
            </div>
          </article>

          <aside className="donation-note premium-card">
            <span className="detail-kicker">More ways to help</span>
            <h3>Listen. Share. Tell a friend.</h3>
            <p>
              Tune in, follow Captain 97, share the stream and tell local businesses you
              heard them on the Captain. Those simple actions help a local station grow.
            </p>
          </aside>
        </div>
      </section>

      <section className="section impact-section" aria-labelledby="impact-heading">
        <div className="container">
          <header className="section-heading">
            <div className="eyebrow dark">Where support goes</div>
            <h2 id="impact-heading">Built here. Heard everywhere.</h2>
            <p>
              Listener support helps cover the real work behind a dependable local
              broadcast and stream.
            </p>
          </header>
          <div className="impact-grid">
            {supportAreas.map(([title, copy], index) => (
              <article className="impact-card premium-card" key={title}>
                <span className="impact-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
