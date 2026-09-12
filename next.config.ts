import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Whether this deployment is genuinely reachable over HTTPS.
 *
 * A plain env var, NOT NEXT_PUBLIC_: those are inlined at build time and could
 * not be changed by restarting. Read when next.config loads at server start,
 * which makes it a deploy setting rather than a build setting.
 */
const httpsEnabled = process.env.HTTPS_ENABLED === 'true';

/**
 * The API origin, as a CSP source.
 *
 * Meal photos are served BY THE API, not by this app, so `img-src 'self'` does
 * not cover them: the browser blocks the request and the admin sees an empty
 * frame after a successful upload, with the only evidence in the console. That
 * is true over https too — a different origin is a different origin — so this
 * is not an http-only concession.
 *
 * Derived from the same variable the client fetches from, so the allowance
 * cannot drift from the origin actually in use. NEXT_PUBLIC_ vars are inlined
 * at build time, and this is read at config load, so a changed API origin needs
 * a rebuild either way.
 */
const apiOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    // A malformed value must not take the whole config down at boot.
    return null;
  }
})();

// Stricter than the storefront's: the dashboard is behind a login, shows
// customer data, and has no reason to load a third-party image or script.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${apiOrigin ? ` ${apiOrigin}` : ''}`,
  "font-src 'self' data:",
  // http: stays allowed without HTTPS — the API is on another subdomain and
  // every call to it is 'http:' in that case.
  `connect-src 'self' https:${isProd && httpsEnabled ? '' : ' ws: wss: http:'}`,
  // Only with real HTTPS: this rewrites every http:// request to https://,
  // which breaks every asset and API call on an http-only host.
  ...(httpsEnabled ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No referrer at all from an authenticated admin surface — a dashboard URL
  // can carry a customer id, and that has no business in another site's logs.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  // The dashboard must never be indexed.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  // HSTS only with real HTTPS. From an http host it is ignored today, but
  // once that host answers https even once the browser pins it for two years
  // and includeSubDomains drags every subdomain along.
  ...(isProd && httpsEnabled
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
