import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import OnAirNow from '@/components/OnAirNow';
import { ListenButton } from '@/components/StationPlayer';
import { siteConfig } from '@/lib/site';

const quickLinks = [
  { href: '/on-air', icon: 'microphone' as const, eyebrow: 'Meet the crew', label: "Who's on air" },
  { href: '/captains-calendar', icon: 'calendar' as const, eyebrow: 'Around town', label: "Captain's Calendar" },
  { href: '/underwriting', icon: 'briefcase' as const, eyebrow: 'Local business', label: 'Underwrite with us' },
  { href: '/donate', icon: 'heart' as const, eyebrow: 'Listener supported', label: 'Support Captain 97' },
];

const stationFeatures = [
  { icon: 'sun' as const, title: 'Dock Rock all day', text: 'Smooth rock, coastal classics and laid-back favorites built for life along the Neuse.' },
  { icon: 'microphone' as const, title: 'Local personalities', text: 'Familiar voices, genuine personality and programming made right here in New Bern.' },
  { icon: 'map-pin' as const, title: 'New Bern first', text: 'Community happenings, local organizations and businesses that keep our corner of Carolina moving.' },
  { icon: 'radio' as const, title: 'Listen anywhere', text: 'Tune to 97.1 FM around New Bern or take the Captain with you through our Live365 stream.' },
];

export default function HomePage() {
  return (
    <main id="main-content">
      <section className="hero hero-premium">
        <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        <div className="sparkle-field" aria-hidden="true"><span /><span /><span /><span /><span /></div>

        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow eyebrow-light"><span className="eyebrow-line" />WXNR-LP · NEW BERN, NORTH CAROLINA</div>
            <h1>Carolina&apos;s<span>Dock Rock.</span></h1>
            <p className="hero-lede">Smooth classics, coastal favorites and real New Bern personality—broadcasting on 97.1 FM and streaming wherever the tide takes you.</p>
            <div className="hero-actions">
              <ListenButton className="btn btn-primary btn-shimmer"><Icon name="play" size={18} />Listen live</ListenButton>
              <Link href="/on-air" className="btn btn-glass">Meet the crew<Icon name="arrow-right" size={17} /></Link>
            </div>
            <div className="frequency-lockup" aria-label="97.1 FM New Bern">
              <strong>97.1</strong><span>FM<small>NEW BERN</small></span><i aria-hidden="true" /><em>WXNR-LP</em>
            </div>
          </div>
          <OnAirNow />
        </div>
        <div className="hero-horizon" aria-hidden="true" />
      </section>

      <section className="quick-strip" aria-label="Explore Captain 97">
        <div className="container quick-grid">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="quick-link">
              <span className="quick-icon" aria-hidden="true"><Icon name={item.icon} size={22} /></span>
              <span><small>{item.eyebrow}</small><strong>{item.label}</strong></span>
              <Icon name="arrow-right" size={16} />
            </Link>
          ))}
        </div>
      </section>

      <section className="section story-section">
        <div className="container story-grid">
          <div className="story-copy reveal-copy">
            <div className="eyebrow">THE SOUND OF COASTAL CAROLINA</div>
            <h2>The soundtrack to<span>life on the water.</span></h2>
            <p className="section-lede">From the smooth harmonies of Hall &amp; Oates to the mellow grooves of Steely Dan, Captain 97 turns an ordinary day into an easy cruise down the Neuse River.</p>
            <p>We&apos;re proudly local, unmistakably coastal and always tuned to New Bern.</p>
            <ListenButton className="text-button">Start listening<Icon name="arrow-right" size={17} /></ListenButton>
          </div>
          <div className="coverage-shell glow-frame">
            <div className="coverage-glint" aria-hidden="true" />
            <Image className="coverage-map-image" src="/coverage-map.png" width={1000} height={998} sizes="(max-width: 900px) 92vw, 46vw" alt="WXNR-LP Captain 97.1 FM coverage map around New Bern" />
            <div className="coverage-label glass-panel"><span className="status-dot status-dot-green" aria-hidden="true" /><small>97.1 FM · NEW BERN</small><strong>WXNR Coverage Area</strong></div>
          </div>
        </div>
      </section>

      <section className="section experience-section">
        <div className="container">
          <div className="section-heading centered-heading"><div className="eyebrow">MORE THAN A PLAYLIST</div><h2>Local radio, elevated.</h2><p>A polished listening experience with the warmth, personality and community connection that only local radio can deliver.</p></div>
          <div className="feature-grid">
            {stationFeatures.map((feature, index) => (
              <article className="feature-card premium-card" key={feature.title}>
                <span className="feature-number">0{index + 1}</span><span className="feature-icon" aria-hidden="true"><Icon name={feature.icon} size={25} /></span><h3>{feature.title}</h3><p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section listening-section">
        <div className="container listening-card glow-frame">
          <div className="listening-copy">
            <div className="eyebrow eyebrow-light">ONE STATION · EVERYWHERE</div><h2>Put the coast in your speakers.</h2><p>Listen locally on 97.1 FM or stream Captain 97 anywhere through Live365. One click, and you&apos;re back on the water.</p>
            <div className="hero-actions"><ListenButton className="btn btn-primary btn-shimmer"><Icon name="play" size={18} />Play Captain 97</ListenButton><a className="btn btn-glass" href={siteConfig.live365Url} target="_blank" rel="noreferrer">Open Live365<Icon name="external-link" size={16} /></a></div>
          </div>
          <div className="dial-art" aria-hidden="true"><div className="dial-ring dial-ring-outer" /><div className="dial-ring dial-ring-inner" /><div className="dial-center"><small>FM</small><strong>97.1</strong><span>NEW BERN</span></div><span className="dial-spark dial-spark-one" /><span className="dial-spark dial-spark-two" /></div>
        </div>
      </section>

      <section className="section partnership-section">
        <div className="container partnership-grid">
          <div><div className="eyebrow">LOCAL BUSINESS · LOCAL IMPACT</div><h2>Be part of the sound of New Bern.</h2><p>Captain 97 gives local businesses a consistent, professional presence with an audience that values the people and places close to home.</p></div>
          <div className="partnership-actions"><Link href="/underwriting" className="btn btn-dark">Explore underwriting<Icon name="arrow-right" size={17} /></Link><a className="inline-contact" href={siteConfig.phone.href}><Icon name="phone" size={18} />{siteConfig.phone.display}</a></div>
        </div>
      </section>

      <section className="section support-section">
        <div className="container support-card glow-frame">
          <div className="support-icon" aria-hidden="true"><Icon name="heart" size={28} /></div>
          <div><div className="eyebrow eyebrow-light">LISTENER SUPPORTED</div><h2>Keep Carolina&apos;s Dock Rock on the air.</h2><p>Your support helps cover the real costs of local broadcasting, streaming and serving the New Bern community.</p></div>
          <Link href="/donate" className="btn btn-light">Support the station<Icon name="arrow-right" size={17} /></Link>
        </div>
      </section>
    </main>
  );
}
