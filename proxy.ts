import createMiddleware from 'next-intl/middleware';
import { routing } from './lib/i18n/routing';

// `proxy.ts` is Next 16's rename of `middleware.ts`.
//
// Kept deliberately thin: locale routing only. Auth gating belongs in the
// server-component layouts that actually need it (app/[locale]/dashboard/layout.tsx),
// not here — middleware runs on every request including static assets, cannot
// read the session without a round trip, and a redirect decided here is
// invisible to the page that gets skipped.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, the /v1 proxy to bobr_backend (next.config.ts rewrites),
  // Next internals and anything with a file extension. Without `v1` here
  // next-intl redirects /v1/auth/... to /pl/v1/auth/... and sign-in 404s.
  matcher: ['/((?!api|v1|_next|_vercel|.*\..*).*)'],
};
