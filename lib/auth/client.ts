'use client';

import { createAuthClient } from 'better-auth/react';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8003';

/**
 * The better-auth browser client. Mirrors bobr_frontend/lib/auth/client.ts on
 * purpose — the two apps talk to the same auth server and must agree on the
 * cookie, or signing in on the storefront leaves the dashboard anonymous.
 *
 * `baseURL` carries the full auth path, not just the origin. The client
 * defaults to `/api/auth`, while our server mounts at `/v1/auth` (it sits under
 * the API's global `v1` prefix) — leave the default in place and every call
 * 404s against a route that looks correctly mounted on the server.
 *
 * `credentials: 'include'` is required because the dashboard and the API are
 * different origins in development (3101 and 8003). Without it the browser
 * sends no cookie and accepts no Set-Cookie, so the session cookie the
 * storefront issued is simply never attached to a dashboard request.
 */
export const authClient = createAuthClient({
  baseURL: `${API_ORIGIN}/v1/auth`,
  fetchOptions: {
    credentials: 'include',
  },
});

/**
 * CONSTRAINT, mirrored from the storefront where it was learned twice.
 *
 * This client only ever sees better-auth's BUILT-IN user fields. The server's
 * `additionalFields` (role, locale) cannot be reached from this repo, and
 * `inferAdditionalFields({...})` does not help — declaring the fields makes
 * them REQUIRED, so omitting them fails too; it is meant as
 * `inferAdditionalFields<typeof auth>()` against the SERVER's auth instance,
 * which lives in another repository.
 *
 * So: no plugins here. The role is read off the SESSION the auth server
 * returns (see lib/auth/session.ts), never widened into these client types.
 */

export const { signIn, signOut, useSession } = authClient;
