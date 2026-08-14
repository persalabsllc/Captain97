import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Local Business Underwriting',
  description:
    'Support community radio and introduce your business to Captain 97.1 listeners with a consistent, professionally produced underwriting campaign.',
  alternates: { canonical: '/underwriting' },
};

const campaignFeatures = [
  {
    number: '01',
    title: 'A polished 60-second message',
    copy: 'We help shape and professionally produce a clear acknowledgement that sounds at home on Captain 97 while observing noncommercial broadcast guidelines.',
  },
  {
    number: '02',
    title: 'Hourly and daily consistency',
    copy: 'Messages are scheduled repeatedly across the broadcast day so your organization can earn familiarity through a steady on-air presence.',
  },
  {
    number: '03',
    title: 'Simple monthly billing',
    copy: 'Our standard campaign commitment is three months, billed monthly, giving your message time to build recognition with the audience.',
  },
];

export default function UnderwritingPage() {
  return (
    <main id="main-content" className="inner-page page-underwriting">
      <PageHero
        eyebrow="Local business · Local radio"
        title="Underwriting"
        intro="Put your name in front of a loyal local audience while helping keep independent community radio strong in New Bern."
      />

      <section className="section underwriting-intro" aria-labelledby="underwriting-intro-heading">
        <div className="container underwriting-intro-grid">
          <div>
            <div className="eyebrow dark">Be heard on Captain 97.1</div>
            <h2 id="underwriting-intro-heading">Local reach with a human voice.</h2>
            <p>
              Captain 97 connects organizations with listeners through consistent,
              locally focused on-air recognition. We&apos;ll work with you from the first
              idea through final production, creating a message that is polished,
              memorable and true to your business.
            </p>
            <div className="underwriting-actions">
              <a className="btn btn-primary" href={siteConfig.phone.href}>
                Call {siteConfig.phone.display}
              </a>
              <Link className="btn btn-outline" href="/contact#underwriting-inquiry">
                Start an inquiry
              </Link>
            </div>
          </div>

          <aside className="underwriting-signal premium-panel" aria-label="Captain 97 underwriting overview">
            <span className="signal-ring signal-ring-one" aria-hidden="true" />
            <span className="signal-ring signal-ring-two" aria-hidden="true" />
            <div className="signal-content">
              <span className="detail-kicker">WXNR-LP · New Bern</span>
              <strong>97.1</strong>
              <p>Professionally produced messages with dependable hourly and daily consistency.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="section campaign-section" aria-labelledby="campaign-heading">
        <div className="container">
          <header className="section-heading">
            <div className="eyebrow dark">How a campaign works</div>
            <h2 id="campaign-heading">A straightforward way to stay top of mind.</h2>
          </header>
          <div className="campaign-grid">
            {campaignFeatures.map((feature) => (
              <article className="campaign-card premium-card" key={feature.number}>
                <span className="campaign-number">{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section underwriting-rules-section">
        <div className="container underwriting-rules premium-panel">
          <div>
            <div className="eyebrow">Made for noncommercial radio</div>
            <h2>Acknowledgement, not traditional advertising.</h2>
          </div>
          <div>
            <p>
              As a noncommercial LPFM station, Captain 97 structures on-air
              acknowledgements to recognize supporters while complying with applicable
              FCC underwriting requirements. Messages may identify your organization,
              products, services, location and contact information, but avoid calls to
              action, prices, inducements, and comparative or qualitative claims.
            </p>
            <p>
              We&apos;ll guide the wording and production so your message is useful to
              listeners and appropriate for the station.
            </p>
          </div>
        </div>
      </section>

      <section className="section page-cta-section">
        <div className="container page-cta premium-panel">
          <div>
            <div className="eyebrow">Support local radio</div>
            <h2>Let&apos;s build your on-air presence.</h2>
            <p>Ask about current availability, rotations and campaign options.</p>
          </div>
          <div className="page-cta-actions">
            <a className="btn btn-light" href={siteConfig.phone.href}>
              Call Captain 97
            </a>
            <Link className="text-link text-link-light" href="/contact#underwriting-inquiry">
              Contact the station <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
