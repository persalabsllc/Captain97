import Link from 'next/link';
import { notFound } from 'next/navigation';

const pages: Record<string, { eyebrow:string; title:string; intro:string; content:React.ReactNode }> = {
  'on-air': {
    eyebrow: 'MEET THE CREW',
    title: 'On Air',
    intro: 'Local voices, good music and the kind of radio that feels like New Bern.',
    content: <div className="cards"><article className="content-card featured-card"><span className="card-icon">🎙️</span><small>WEEKDAYS · 2–7 PM</small><h2>Meg Unfiltered</h2><p>Dock rock, personality and an unfiltered afternoon soundtrack for the ride home.</p></article><article className="content-card"><span className="card-icon">📻</span><small>CAPTAIN 97.1</small><h2>More from the crew</h2><p>We&apos;re building this page into a live on-air board with host photos, bios, schedules and real-time “in the studio” status.</p></article></div>
  },
  'captains-calendar': {
    eyebrow: 'AROUND NEW BERN', title: "Captain's Calendar", intro: 'Community happenings, local events and places worth showing up for.',
    content: <div className="content-card"><span className="card-icon">⚓</span><h2>Community calendar</h2><p>The Captain&apos;s Calendar remains part of the new site and is ready for a cleaner event system. Upcoming events can be added here as simple cards and later managed from a station dashboard.</p><Link className="text-link" href="/contact">Send us an event →</Link></div>
  },
  underwriting: {
    eyebrow: 'LOCAL BUSINESS · LOCAL RADIO', title: 'Underwriting', intro: 'Put your business in front of a loyal local audience while supporting community radio.',
    content: <div className="cards"><article className="content-card featured-card"><span className="card-icon">📣</span><h2>Be heard on Captain 97.1</h2><p>Captain 97 connects New Bern businesses with listeners through consistent, locally focused on-air recognition. We can help create and produce your message.</p><Link className="btn btn-primary" href="/contact">Talk With Captain 97</Link></article><article className="content-card"><span className="card-icon">⚓</span><h2>Built for local businesses</h2><p>Ask about current underwriting opportunities, rotating dayparts, production and multi-month campaigns.</p><p className="muted">As an LPFM station, on-air acknowledgements are structured to comply with noncommercial underwriting requirements.</p></article></div>
  },
  donate: {
    eyebrow: 'KEEP CAROLINA’S DOCK ROCK ON THE AIR', title: 'Support Captain 97', intro: 'Local radio takes a community. Your support helps keep WXNR-LP broadcasting and streaming from New Bern.',
    content: <div className="cards"><article className="content-card featured-card donation-card"><span className="card-icon">♥</span><h2>Make a contribution</h2><p>Help with studio costs, tower expenses, streaming, equipment and the day-to-day work of keeping a local station on the air.</p><div className="donation-options"><button>$10</button><button>$25</button><button>$50</button><button>$97</button></div><p className="muted">Online donation processing is ready to connect to the station&apos;s preferred payment provider before the domain goes live.</p></article><article className="content-card"><span className="card-icon">📻</span><h2>Other ways to support</h2><p>Listen. Share Captain 97 with a friend. Follow the station on social media. Tell local businesses you heard them on the Captain.</p><Link className="text-link" href="/contact">Contact the station →</Link></article></div>
  },
  contact: {
    eyebrow: 'GET IN TOUCH', title: 'Contact Captain 97', intro: 'Have an event, song request, underwriting question or something we should know about?',
    content: <div className="cards"><article className="content-card featured-card"><span className="card-icon">✉️</span><h2>Send us a message</h2><form className="contact-form"><label>Name<input name="name" placeholder="Your name" /></label><label>Email<input type="email" name="email" placeholder="you@example.com" /></label><label>Message<textarea name="message" rows={6} placeholder="What’s on your mind?" /></label><button type="button" className="btn btn-primary">Send Message</button></form><p className="muted">The visual form is in place; message delivery will be connected when we configure the production backend.</p></article><article className="content-card"><span className="card-icon">📍</span><h2>New Bern, North Carolina</h2><p><strong>Captain 97.1 · WXNR-LP</strong></p><p>Listen locally on 97.1 FM or stream online from anywhere.</p><div className="social-stack"><a href="https://www.facebook.com/p/Captain-97-61566324394330/">Facebook ↗</a><a href="https://www.instagram.com/captain97radio/">Instagram ↗</a><a href="https://live365.com/station/Captain-97-a57695">Live365 ↗</a></div></article></div>
  },
};

export function generateStaticParams() { return Object.keys(pages).map(slug => ({slug})); }

export default async function ContentPage({ params }: { params: Promise<{slug:string}> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();
  return <main className="inner-page"><section className="inner-hero"><div className="container"><div className="eyebrow">{page.eyebrow}</div><h1>{page.title}</h1><p>{page.intro}</p></div></section><section className="section"><div className="container">{page.content}</div></section></main>;
}
