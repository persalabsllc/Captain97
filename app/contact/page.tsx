import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact Captain 97.1',
  description:
    'Contact WXNR-LP Captain 97.1 in New Bern for community events, underwriting, station questions and listener support.',
  alternates: { canonical: '/contact' },
};

type Inquiry = {
  id: string;
  title: string;
  copy: string;
  subject: string;
  body: string;
};

const inquiries: Inquiry[] = [
  {
    id: 'event-inquiry',
    title: 'Community calendar',
    copy: "Tell us about a festival, fundraiser, performance or community gathering for the Captain's Calendar.",
    subject: "Captain's Calendar event submission",
    body: 'Event name:\nDate and time:\nLocation:\nPublic link or contact:\nEvent details:',
  },
  {
    id: 'underwriting-inquiry',
    title: 'Business underwriting',
    copy: 'Ask about current on-air availability and building a consistent local presence with Captain 97.',
    subject: 'Captain 97 underwriting inquiry',
    body: 'Name:\nBusiness or organization:\nPhone:\nWhat would you like listeners to know?',
  },
  {
    id: 'support-inquiry',
    title: 'Listener support',
    copy: 'Connect with the station about contributing, volunteering or another way to help local radio.',
    subject: 'Supporting Captain 97',
    body: 'Name:\nPhone:\nHow would you like to support Captain 97?',
  },
  {
    id: 'station-inquiry',
    title: 'Station and listener questions',
    copy: 'Share feedback, ask a station question or send a note to the crew at Captain 97.',
    subject: 'Captain 97 listener message',
    body: 'Name:\nPhone:\nMessage:',
  },
];

function inquiryHref(inquiry: Inquiry) {
  if (!siteConfig.email) return siteConfig.phone.href;

  const query = new URLSearchParams({
    subject: inquiry.subject,
    body: inquiry.body,
  });
  return `${siteConfig.email.href}?${query.toString()}`;
}

export default function ContactPage() {
  const hasEmail = Boolean(siteConfig.email);

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
                Choose a topic below to reach the station. If your question doesn&apos;t fit
                a category, give us a call and we&apos;ll point you in the right direction.
              </p>
            </header>

            <div className="inquiry-list">
              {inquiries.map((inquiry, index) => (
                <article className="inquiry-card premium-card" id={inquiry.id} key={inquiry.id}>
                  <span className="inquiry-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>{inquiry.title}</h3>
                    <p>{inquiry.copy}</p>
                    <a className="text-link" href={inquiryHref(inquiry)}>
                      {hasEmail ? 'Open email' : 'Call the station'} <span aria-hidden="true">→</span>
                    </a>
                  </div>
                </article>
              ))}
            </div>
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
