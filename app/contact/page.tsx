import type { Metadata } from 'next';
import ContactForm from '@/components/ContactForm';
import PageHero from '@/components/PageHero';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact Captain 97.1',
  description:
    'Contact WXNR-LP Captain 97.1 in New Bern for community events, underwriting, station questions and listener support.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <main id="main-content" className="inner-page page-contact">
      <PageHero
        eyebrow="Get in touch"
        title="Contact Captain 97"
        intro="Have an event, an underwriting question or something the station should know about? We're listening."
      />

      <section className="section contact-section" aria-labelledby="contact-heading">
        <div className="container contact-grid">
          <div className="contact-main">
            <header className="section-heading">
              <div className="eyebrow dark">Start a conversation</div>
              <h2 id="contact-heading">What can the Captain help with?</h2>
              <p>
                Send a music request, share an announcement, ask about underwriting or
                simply say hello. Your message will be emailed straight to the station.
              </p>
            </header>

            <ContactForm />
          </div>

          <aside className="station-contact premium-panel" aria-labelledby="studio-heading">
            <div className="station-contact-frequency">97.1</div>
            <span className="detail-kicker">WXNR-LP · New Bern</span>
            <h2 id="studio-heading">Captain 97 Studios</h2>

            <div className="contact-detail">
              <span>Call the station</span>
              <a href={siteConfig.phone.href}>{siteConfig.phone.display}</a>
            </div>

            {siteConfig.email ? (
              <div className="contact-detail">
                <span>Email</span>
                <a href={siteConfig.email.href}>{siteConfig.email.display}</a>
              </div>
            ) : null}

            <div className="contact-detail">
              <span>Visit or send mail</span>
              <address>
                {siteConfig.address.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
              <a className="text-link text-link-light" href={siteConfig.address.mapUrl} target="_blank" rel="noreferrer">
                Open in maps <span aria-hidden="true">↗</span>
              </a>
            </div>

            <div className="contact-detail">
              <span>Follow along</span>
              <div className="contact-socials">
                {siteConfig.socials.map((social) => (
                  <a href={social.href} key={social.label} target="_blank" rel="noreferrer">
                    {social.label} <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
