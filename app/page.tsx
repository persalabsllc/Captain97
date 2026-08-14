import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-sun" />
        <div className="hero-wave hero-wave-one" />
        <div className="hero-wave hero-wave-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">WXNR-LP · NEW BERN, NORTH CAROLINA</div>
            <h1>Carolina&apos;s<br/><span>Dock Rock.</span></h1>
            <p>At Captain 97, we bring you the smooth sounds of dock rock, our unique take on the beloved yacht rock genre. Imagine boating down the Neuse River on a sun-soaked day with a gentle breeze in your hair as we spin laid-back classics and contemporary favorites.</p>
            <div className="hero-actions">
              <a href="#listen" className="btn btn-primary">▶ Listen Live</a>
              <Link href="/on-air" className="btn btn-ghost">Meet the Crew</Link>
            </div>
            <div className="frequency-lockup"><strong>97.1</strong><span>FM<br/>NEW BERN</span></div>
          </div>

          <div className="radio-card">
            <div className="radio-card-top"><span className="live-badge">● ON AIR</span><span>WXNR-LP</span></div>
            <div className="album-art">
              <div className="album-boat">⛵</div>
              <div className="album-title">CAPTAIN<br/><b>97.1</b></div>
              <div className="album-tag">CAROLINA&apos;S DOCK ROCK</div>
            </div>
            <div className="now-playing-preview"><small>NOW PLAYING</small><strong>Live from New Bern</strong><span>Tap play below to start the stream</span></div>
            <a href="#listen" className="big-play" aria-label="Jump to live player">▶</a>
          </div>
        </div>
      </section>

      <section className="quick-strip">
        <div className="container quick-grid">
          <Link href="/on-air"><span>🎙️</span><div><small>THE CREW</small><strong>Who&apos;s On Air</strong></div></Link>
          <Link href="/captains-calendar"><span>⚓</span><div><small>AROUND TOWN</small><strong>Captain&apos;s Calendar</strong></div></Link>
          <Link href="/underwriting"><span>📻</span><div><small>LOCAL BUSINESS</small><strong>Underwrite With Us</strong></div></Link>
          <Link href="/donate"><span>♥</span><div><small>KEEP US ON AIR</small><strong>Support Captain 97</strong></div></Link>
        </div>
      </section>

      <section className="section about-section">
        <div className="container two-col">
          <div>
            <div className="eyebrow dark">THE SOUND OF COASTAL CAROLINA</div>
            <h2>Laid-back music.<br/>Local personality.</h2>
            <p>From the smooth harmonies of Hall &amp; Oates to the mellow grooves of Steely Dan, our carefully curated selection captures the essence of Coastal Carolina living, making every moment feel like a getaway on the water.</p>
            <p>Listen on <strong>97.1 FM</strong> around New Bern or stream Captain 97 anywhere online.</p>
            <a href="#listen" className="text-link">Start listening →</a>
          </div>
          <div className="coastal-card">
            <div className="coastal-sky" />
            <div className="coastal-sun" />
            <div className="coastal-water" />
            <div className="coastal-boat">⛵</div>
            <blockquote>“Tune in and let the rhythm of dock rock transport you to your happy place.”</blockquote>
          </div>
        </div>
      </section>

      <section className="section feature-section">
        <div className="container">
          <div className="section-heading"><div className="eyebrow dark">MORE THAN A PLAYLIST</div><h2>Your local station, built for New Bern.</h2></div>
          <div className="feature-grid">
            <article><span>☀️</span><h3>Dock Rock All Day</h3><p>Smooth rock, yacht-rock favorites and coastal classics that fit life on the Neuse.</p></article>
            <article><span>🎙️</span><h3>Local Personalities</h3><p>Real voices, local conversation, news, weather and familiar faces from the community.</p></article>
            <article><span>📍</span><h3>New Bern First</h3><p>Community events, local organizations and businesses that make our corner of North Carolina special.</p></article>
            <article><span>📱</span><h3>Listen Anywhere</h3><p>97.1 FM locally and Live365 streaming wherever your day takes you.</p></article>
          </div>
        </div>
      </section>

      <section className="section future-section">
        <div className="container future-grid">
          <div><div className="eyebrow">COMING TO CAPTAIN97.COM</div><h2>A better way to listen — and connect.</h2><p>This new site is designed for the next version of Captain 97: live song data, who&apos;s in the studio, listener chat, song requests and more.</p></div>
          <div className="future-ui">
            <div><small>NOW PLAYING</small><strong>Song + Artist</strong><span className="waveform">▂▅▇▃▆▂▇▅▃▆▇▂</span></div>
            <div><small>IN THE STUDIO</small><strong>DJ status</strong><span>● Live</span></div>
            <div><small>LISTENER LINE</small><strong>Chat + Requests</strong><span>Coming soon</span></div>
          </div>
        </div>
      </section>

      <section className="section support-section">
        <div className="container support-card">
          <div><div className="eyebrow">LISTENER SUPPORTED</div><h2>Help keep Captain 97 on the air.</h2><p>Captain 97 is a local LPFM station. Listener support helps cover the real costs of keeping the music, community programming and broadcast signal going.</p></div>
          <Link href="/donate" className="btn btn-light">Support the Station ♥</Link>
        </div>
      </section>
    </main>
  );
}
