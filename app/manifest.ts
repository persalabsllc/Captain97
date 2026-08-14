import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: `Listen live to ${siteConfig.callSign} ${siteConfig.name} in ${siteConfig.location} — ${siteConfig.tagline}.`,
    id: '/',
    start_url: '/',
    scope: '/',
    lang: 'en-US',
    display: 'standalone',
    background_color: '#0b1022',
    theme_color: '#121934',
    categories: ['music', 'entertainment', 'radio'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
