import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: "Captain's Calendar",
  description:
    "Discover community happenings around New Bern and share a local event with the Captain's Calendar on WXNR-LP.",
  alternates: { canonical: '/captains-calendar' },
};

export default function CaptainsCalendarPage() {
  return (
    <main id="main-content" className="inner-page page-calendar">
      <PageHero
        eyebrow="Around New Bern"
        title="Captain's Calendar"
        intro="Community gatherings, local traditions and the places worth showing up for across our corner of coastal Carolina."
      />

      <section className="section calendar-section" aria-labelledby="calendar-heading">
        <div className="container calendar-layout">
          <article className="calendar-empty premium-panel">
            <div className="calendar-compass" aria-hidden="true">
              <span>97.1</span>
            </div>
            <div className="calendar-empty-copy">
              <div className="eyebrow dark">Fresh listings ahead</div>
              <h2 id="calendar-heading">The next good reason to leave the dock.</h2>
              <p>
                There are no featured events on the calendar at the moment. We&apos;re
                gathering the festivals, fundraisers, performances and community days
                New Bern listeners should know about, so check back soon.
              </p>
              <div className="calendar-actions">
                <Link className="btn btn-primary" href="/contact#event-inquiry">
                  Share an event
                </Link>
                <a className="btn btn-outline" href={siteConfig.phone.href}>
                  Call {siteConfig.phone.display}
                </a>
              </div>
            </div>
          </article>

          <aside className="calendar-submit-card premium-card" aria-labelledby="calendar-submit-heading">
            <span className="detail-kicker">For organizers</span>
            <h3 id="calendar-submit-heading">Put your event on our radar.</h3>
            <p>
              Send the event name, date and time, location, a brief description and the
              best public link or contact information. Our team reviews submissions for
              local relevance and available calendar space.
            </p>
            <ul className="detail-list">
              <li>Community and nonprofit events</li>
              <li>Arts, music and cultural happenings</li>
              <li>Festivals, markets and family events</li>
            </ul>
            <Link className="text-link" href="/contact#event-inquiry">
              Send event details <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
