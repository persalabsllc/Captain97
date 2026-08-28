import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

function configuredOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isLocalDevelopment = isDevelopment
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    return url.protocol === 'https:' || (isLocalDevelopment && url.protocol === 'http:')
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

const monitoringAudioOrigins = Array.from(new Set([
  configuredOrigin(process.env.MONITORING_STL_AUDIO_URL),
  configuredOrigin(process.env.MONITORING_OFFAIR_AUDIO_URL),
  configuredOrigin(process.env.MONITORING_STREAM_AUDIO_URL),
].filter((origin): origin is string => Boolean(origin))));
const monitoringAudioSourcePolicy = monitoringAudioOrigins.length
  ? ` ${monitoringAudioOrigins.join(' ')}`
  : '';

function contentSecurityPolicy(extraAudioOrigins = '') {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `media-src 'self' blob: https://streaming.live365.com https://*.live365.com https://*.cdnstream.com${extraAudioOrigins}`,
    `connect-src 'self' https://streaming.live365.com https://*.live365.com https://*.cdnstream.com${extraAudioOrigins}${isDevelopment ? ' ws: wss:' : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'self'",
    ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

const baseContentSecurityPolicy = contentSecurityPolicy();
const monitoringContentSecurityPolicy = contentSecurityPolicy(monitoringAudioSourcePolicy);

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: baseContentSecurityPolicy,
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  ...(isVercelPreview
    ? [
        {
          key: 'X-Robots-Tag',
          value: 'noindex, nofollow',
        },
      ]
    : []),
  ...(!isDevelopment
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/monitoring/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: monitoringContentSecurityPolicy,
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/events',
        destination: '/captains-calendar',
        permanent: true,
      },
      {
        source: '/events/:path*',
        destination: '/captains-calendar',
        permanent: true,
      },
      {
        source: '/event/:path*',
        destination: '/captains-calendar',
        permanent: true,
      },
      {
        source: '/community',
        destination: '/',
        permanent: true,
      },
      {
        source: '/community/:path*',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
