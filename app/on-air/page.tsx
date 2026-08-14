import type { Metadata } from 'next';
import OnAirNow from '@/components/OnAirNow';
import PageHero from '@/components/PageHero';
import { ListenButton } from '@/components/StationPlayer';
import { scheduleGroups } from '@/lib/schedule';

export const metadata: Metadata = {
  title: 'On Air & Program Schedule',
  description:
    "Meet the voices of Captain 97.1 and see the weekly WXNR-LP program schedule for Carolina's Dock Rock in New Bern.",
  alternates: { canonical: '/on-air' },
};

export default function OnAirPage() {
  return (
    <main id="main-content" className="inner-page page-on-air">
      <PageHero
        eyebrow="Live from New Bern"
        title="On Air"
        intro="Local voices, coastal favorites and the kind of radio that feels right at home on the Neuse."
      />

      <section className="section on-air-feature" aria-labelledby="on-air-now-heading">
        <div className="container on-air-feature-grid">
          <div className="on-air-feature-copy">
            <div className="eyebrow dark">WXNR-LP · 97.1 FM</div>
            <h2 id="on-air-now-heading">Your soundtrack is already waiting.</h2>
            <p>
              Tune in around New Bern on 97.1 FM or take Captain 97 with you anywhere.
              Our live stream keeps Carolina&apos;s Dock Rock within reach from the first
              cup of coffee to the last light on the water.
            </p>
            <ListenButton className="btn btn-primary">Listen live</ListenButton>
          </div>
          <div className="on-air-stage premium-panel">
            <OnAirNow />
          </div>
        </div>
      </section>

      <section className="section schedule-section" aria-labelledby="weekly-lineup-heading">
        <div className="container">
          <header className="section-heading schedule-heading">
            <div className="eyebrow dark">The weekly lineup</div>
            <h2 id="weekly-lineup-heading">Meet you on the dial.</h2>
            <p>
              All times are Eastern. Outside the featured shows below, Captain 97 keeps
              the Dock Rock flowing with our regular station programming.
            </p>
          </header>

          <div className="schedule-groups">
            {scheduleGroups.map((group) => (
              <section className="schedule-group" key={group.dayLabel} aria-labelledby={`schedule-${group.dayLabel.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
                <div className="schedule-day">
                  <span className="schedule-day-mark" aria-hidden="true" />
                  <h3 id={`schedule-${group.dayLabel.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{group.dayLabel}</h3>
                </div>
                <div className="schedule-list">
                  {group.shows.map((show, index) => (
                    <article className="schedule-card premium-card" key={`${show.name}-${show.time}`}>
                      <div className="schedule-number" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="schedule-card-copy">
                        <p className="schedule-time">{show.time}</p>
                        <h4>{show.name}</h4>
                        {show.description ? <p>{show.description}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="section page-cta-section">
        <div className="container page-cta premium-panel">
          <div>
            <div className="eyebrow">97.1 FM · New Bern</div>
            <h2>Ready to set sail?</h2>
            <p>Press play and settle into Carolina&apos;s Dock Rock.</p>
          </div>
          <ListenButton className="btn btn-light">Play Captain 97</ListenButton>
        </div>
      </section>
    </main>
  );
}
