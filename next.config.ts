import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Refuse to build on Vercel with a missing or local address.
 *
 * NEXT_PUBLIC_* values are inlined into the bundle at BUILD time, and every
 * client module falls back to http://localhost:… when one is unset. So a Vercel
 * build without them does not fail — it ships a site whose browser code calls
 * the visitor's own machine. That happened on 2026-09-13: the dashboard
 * redirected everyone to http://localhost:3100/pl/login and the storefront
 * called http://localhost:8003. Failing the build keeps the previous working
 * deployment live and names the variable to set.
 *
 * Only on Vercel (VERCEL=1): local builds read .env.local, where localhost is
 * exactly right.
 */
const REQUIRED_PUBLIC_URLS: ReadonlyArray<[string, string]> = [
  ['NEXT_PUBLIC_API_URL', "this app's own origin, which proxies /v1 to the API"],
  ['NEXT_PUBLIC_STOREFRONT_URL', 'the storefront origin, where customer accounts live'],
];
// Not public, but just as fatal when missing: without it there is no /v1 proxy,
// NEXT_PUBLIC_API_URL (this app's own origin) answers /v1/* with a 404, and
// nobody can sign in. See apiUpstream below.
const REQUIRED_SERVER_URLS: ReadonlyArray<[string, string]> = [
  ['API_UPSTREAM_URL', 'the real BOBR API origin that /v1/* is proxied to'],
];
if (process.env.VERCEL === '1') {
  const problems = [...REQUIRED_PUBLIC_URLS, ...REQUIRED_SERVER_URLS].flatMap(([name, what]) => {
    const value = process.env[name];
    if (!value) return [`${name} is not set (${what})`];
    if (/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(value)) {
      return [`${name} points at ${value} (${what})`];
    }
    return [];
  });
  // Same origin for both silently disables the /v1 proxy (see apiUpstream
  // below) and brings ebneely/bobr-dashboard#32 back: sign-in "works" and the
  // next page is anonymous. Refused here rather than discovered in production.
  try {
    const publicApi = process.env.NEXT_PUBLIC_API_URL;
    const upstream = process.env.API_UPSTREAM_URL;
    if (publicApi && upstream && new URL(publicApi).origin === new URL(upstream).origin) {
      problems.push(
        `API_UPSTREAM_URL has the same origin as NEXT_PUBLIC_API_URL (${upstream}); NEXT_PUBLIC_API_URL must be this app's own origin and API_UPSTREAM_URL the real API`,
      );
    }
  } catch {
    problems.push('NEXT_PUBLIC_API_URL or API_UPSTREAM_URL is not a valid URL');
  }
  if (problems.length > 0) {
    throw new Error(
      `Refusing to build: ${problems.join('; ')}. Set it in Vercel → Settings → Environment Variables, then redeploy without the build cache.`,
    );
  }
}

/**
 * Whether this deployment is genuinely reachable over HTTPS.
 *
 * A plain env var, NOT NEXT_PUBLIC_: those are inlined at build time and could
 * not be changed by restarting. Read when next.config loads at server start,
 * which makes it a deploy setting rather than a build setting.
 */
const httpsEnabled = process.env.HTTPS_ENABLED === 'true';

/**
 * Where /v1/* is proxied to, or null when the browser calls the API directly.
 *
 * better-auth's session cookie is host-only and SameSite=Lax, so it belongs to
 * whichever origin answered the sign-in. Called cross-site (vercel.app → the
 * API host) the cookie lands on the API host and is never sent back: sign-in
 * "succeeds" and the next page bounces to login (ebneely/bobr-dashboard#32). So
 * in production NEXT_PUBLIC_API_URL is THIS app's origin and the rewrite below
 * forwards /v1/* to API_UPSTREAM_URL — the cookie is first-party.
 *
 * A plain server var, read when next.config loads. Unset, or the same origin as
 * NEXT_PUBLIC_API_URL (local dev: both http://localhost:8003), means no rewrite:
 * proxying an origin to itself would loop.
 */
const apiUpstream = (() => {
  const raw = process.env.API_UPSTREAM_URL;
  if (!raw) return null;
  try {
    const upstream = new URL(raw).origin;
    const publicApi = process.env.NEXT_PUBLIC_API_URL;
    if (publicApi && new URL(publicApi).origin === upstream) return null;
    return upstream;
  } catch {
    return null;
  }
})();

const imageOrigins = (() => {
  // Where meal photographs are actually fetched FROM.
  //
  // Not necessarily the API: with imgproxy configured the API hands out URLs on
  // the imgproxy host, and with neither imgproxy nor a bucket it serves the
  // bytes itself at /v1/files. Both are cross-origin to this app, so `'self'`
  // covers neither, and `https:` covers neither on the http-only host this
  // project targets.
  //
  // Getting this wrong fails silently in the one way that matters: the request
  // is blocked, the card draws an empty frame, and nothing but the console says
  // why. So every origin an image can come from is listed here — including the
  // upstream: behind the /v1 proxy the API still builds absolute URLs on its
  // own host.
  const origins = new Set();
  for (const raw of [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.API_UPSTREAM_URL,
    process.env.NEXT_PUBLIC_IMAGE_HOST,
  ]) {
    if (!raw) continue;
    try {
      origins.add(new URL(raw).origin);
    } catch {
      // A malformed value must not take the whole config down at boot.
    }
  }
  return [...origins];
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
  `img-src 'self' data: blob:${imageOrigins.map((o) => ` ${o}`).join('')}`,
  "font-src 'self' data:",
  // http: stays allowed without HTTPS — the API is on another subdomain and
  // every call to it is 'http:' in that case. Behind the /v1 proxy the browser
  // only ever calls 'self'; https: stays for anything still pointed at the API
  // host directly.
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
  // beforeFiles, so /v1/* never reaches the [locale] routes or the filesystem.
  // proxy.ts excludes v1 from its matcher for the same reason: next-intl would
  // otherwise redirect /v1/auth/... to /pl/v1/auth/... first.
  async rewrites() {
    return apiUpstream
      ? { beforeFiles: [{ source: '/v1/:path*', destination: `${apiUpstream}/v1/:path*` }] }
      : [];
  },
};

export default withNextIntl(nextConfig);
