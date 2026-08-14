import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob: https://streaming.live365.com https://*.live365.com https://*.cdnstream.com",
  `connect-src 'self' https://streaming.live365.com https://*.live365.com https://*.cdnstream.com${isDevelopment ? ' ws: wss:' : ''}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
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
