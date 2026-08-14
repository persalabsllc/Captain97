import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main id="main-content" className="inner-page">
      <section className="inner-hero">
        <div className="container">
          <div className="eyebrow">OFF THE CHARTS</div>
          <h1>That page sailed away.</h1>
          <p>
            We could not find the page you requested, but Carolina&apos;s Dock Rock
            is still live from New Bern.
          </p>
          <Link className="btn btn-primary" href="/">
            Return to Captain 97
          </Link>
        </div>
      </section>
    </main>
  );
}
