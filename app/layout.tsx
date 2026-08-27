import type { Metadata, Viewport } from 'next';
import SiteShell from '@/components/SiteShell';
import { siteConfig } from '@/lib/site';
import './globals.css';

const isProduction = process.env.VERCEL_ENV === 'production';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "Captain 97.1 | Carolina's Dock Rock",
    template: "%s | Captain 97.1",
  },
  description: "WXNR-LP Captain 97.1 in New Bern, North Carolina — Carolina's Dock Rock. Listen live online or on 97.1 FM.",
  keywords: ['Captain 97', 'WXNR-LP', 'New Bern radio', '97.1 FM', 'yacht rock', 'dock rock', 'Carolina radio'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Captain 97.1',
    title: "Captain 97.1 | Carolina's Dock Rock",
    description: 'Smooth classics, coastal favorites and local personality from New Bern, North Carolina.',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Captain 97.1 | Carolina's Dock Rock",
    description: 'Listen live to WXNR-LP 97.1 FM from New Bern, North Carolina.',
  },
  robots: isProduction
    ? { index: true, follow: true }
    : { index: false, follow: false, noarchive: true },
};

export const viewport: Viewport = {
  themeColor: '#121934',
  colorScheme: 'light',
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': ['RadioStation', 'Organization'],
  name: 'Captain 97.1',
  alternateName: 'WXNR-LP',
  url: siteConfig.siteUrl,
  telephone: siteConfig.phone.display,
  slogan: "Carolina's Dock Rock",
  address: {
    '@type': 'PostalAddress',
    streetAddress: '1423 South Glenburnie Road, Suite C',
    addressLocality: 'New Bern',
    addressRegion: 'NC',
    postalCode: '28562',
    addressCountry: 'US',
  },
  sameAs: siteConfig.socials.map((social) => social.href),
  broadcastFrequency: {
    '@type': 'BroadcastFrequencySpecification',
    broadcastFrequencyValue: '97.1',
    broadcastSignalModulation: 'FM',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <SiteShell>{children}</SiteShell>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}
