import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: "Captain 97.1 | Carolina's Dock Rock",
  description: "WXNR-LP Captain 97.1 in New Bern, North Carolina — Carolina's Dock Rock. Listen live online or on 97.1 FM.",
};

const nav = [
  ['On Air', '/on-air'],
  ["Captain's Calendar", '/captains-calendar'],
  ['Underwriting', '/underwriting'],
  ['Donate', '/donate'],
  ['Contact', '/contact'],
];

function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Captain 97 home">
      <span className="logo-anchor">⚓</span>
      <span className="logo-main">CAPTAIN</span>
      <span className="logo-97">97.1</span>
      <span className="logo-tag">CAROLINA&apos;S DOCK ROCK</span>
    </Link>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Logo />
            <nav className="main-nav" aria-label="Main navigation">
              {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
            </nav>
            <a className="listen-pill" href="#listen">● Listen Live</a>
          </div>
        </header>
        {children}
        <footer className="footer">
          <div className="footer-grid">
            <div>
              <Logo />
              <p>WXNR-LP · New Bern, North Carolina</p>
              <p className="muted">Smooth classics, coastal favorites and Carolina&apos;s Dock Rock.</p>
            </div>
            <div>
              <h3>Explore</h3>
              {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
            </div>
            <div>
              <h3>Listen</h3>
              <p>97.1 FM in New Bern</p>
              <a href="https://live365.com/station/Captain-97-a57695" target="_blank" rel="noreferrer">Live365 Station Page ↗</a>
              <div className="social-row"><a href="https://www.facebook.com/p/Captain-97-61566324394330/">Facebook</a><a href="https://www.instagram.com/captain97radio/">Instagram</a></div>
            </div>
          </div>
          <div className="footer-bottom">© 2026 Captain 97.1 · WXNR-LP · New Bern, NC</div>
        </footer>

        <section id="listen" className="player-dock" aria-label="Captain 97 live player">
          <div className="player-copy"><span className="live-dot" /> <strong>LIVE</strong><span>Captain 97.1</span><small>Carolina&apos;s Dock Rock</small></div>
          <iframe
            title="Captain 97 Live365 player"
            src="https://live365.com/embeds/v1/player/a57695?c=mp3&m=dark&s=sm"
            width="100%"
            height="115"
            frameBorder="0"
            allow="autoplay"
          />
        </section>
      </body>
    </html>
  );
}
