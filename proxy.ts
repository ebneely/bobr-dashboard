import { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { PATHNAME_HEADER } from './lib/auth/urls';
import { routing } from './lib/i18n/routing';

// `proxy.ts` is Next 16's rename of `middleware.ts`.
//
// Kept deliberately thin: locale routing, plus stamping the requested pathname
// on the request. Auth gating belongs in the server-component layouts that
// actually need it (app/[locale]/dashboard/layout.tsx), not here — middleware
// runs before the session is known, and a redirect decided here is invisible
// to the page that gets skipped.
//
// The pathname header exists because a server layout is never told its
// pathname; without it a signed-out visitor to /pl/dashboard/orders came back
// to /pl/dashboard after sign-in (ebneely/bobr-dashboard#35). It is always
// overwritten here, so a client cannot supply its own — and the layout only
// uses it as a `?redirect=` that the login page re-validates anyway.
const handleLocale = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // A fresh request rather than `request.headers.set`: the incoming headers do
  // not reach the forwarded request when mutated in place. next-intl copies
  // this request's headers into the one it forwards, so the header reaches
  // `headers()` in server components.
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return handleLocale(new NextRequest(request, { headers }));
}

export const config = {
  // Skip API routes, the /v1 proxy to bobr_backend (next.config.ts rewrites),
  // Next internals and anything with a file extension. Without `v1` here
  // next-intl redirects /v1/auth/... to /pl/v1/auth/... and sign-in 404s.
  //
  // The backslash is doubled on purpose. With a single one the string holds
  // `.*..*` ("any two characters"), which excluded every path except `/`: the
  // proxy never ran for /pl/dashboard/... at all (found via dashboard#35).
  matcher: ['/((?!api|v1|_next|_vercel|.*\\..*).*)'],
};
