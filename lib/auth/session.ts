import { cache } from 'react';
import { headers } from 'next/headers';
import { createAuthClient } from 'better-auth/client';

import { asRole, type Role } from './roles';

/**
 * Server renders call the API directly, never through this app's own /v1
 * proxy. In production NEXT_PUBLIC_API_URL is this app's origin (the browser's
 * same-origin route to the API); a server render calling itself through a
 * rewrite would be a pointless extra hop — and on the build machine, a call to
 * a site that may not be up yet. API_UPSTREAM_URL is the real API origin.
 */
const API_ORIGIN =
  process.env.API_UPSTREAM_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8003';

/**
 * A second, framework-agnostic client for server use. The one in ./client.ts
 * is `'use client'` and reads the browser's cookie jar, which does not exist
 * during a server render — here the cookie has to be forwarded by hand.
 */
const serverAuthClient = createAuthClient({
  baseURL: `${API_ORIGIN}/v1/auth`,
});

export interface DashboardSession {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly role: Role;
  };
  /** True when the session came from BOBR_DEV_STUB_ROLE, not from the API. */
  readonly stubbed: boolean;
}

/**
 * Development-only session stub.
 *
 * There is no database provisioned yet, so the auth server cannot issue a real
 * session and no signed-in state can be reached by hand. Setting
 * BOBR_DEV_STUB_ROLE=ADMIN in .env.local fabricates one so the shell can be
 * built and looked at. Guarded on NODE_ENV so a production build cannot be
 * talked into an unauthenticated admin session by an environment variable.
 */
function devStubSession(): DashboardSession | null {
  if (process.env.NODE_ENV === 'production') return null;
  const role = asRole(process.env.BOBR_DEV_STUB_ROLE);
  if (!role) return null;
  return {
    user: {
      id: 'dev-stub',
      name: process.env.BOBR_DEV_STUB_NAME ?? 'Anna Kowalska',
      email: 'stub@bobr.local',
      role,
    },
    stubbed: true,
  };
}

/**
 * The signed-in person, or null.
 *
 * `cache` de-duplicates the call for one request — the layout and the page it
 * wraps both ask, and without this each render of the tree is a second HTTP
 * round trip to the auth server.
 */
export const getServerSession = cache(
  async (): Promise<DashboardSession | null> => {
    const stub = devStubSession();
    if (stub) return stub;

    // Forward the incoming request's cookies verbatim. better-auth identifies
    // the session purely by cookie, and a server render carries none of its own.
    const cookie = (await headers()).get('cookie') ?? '';
    if (!cookie) return null;

    try {
      const { data } = await serverAuthClient.getSession({
        fetchOptions: { headers: { cookie } },
      });
      const user = data?.user as
        | { id: string; name?: string | null; email: string; role?: unknown }
        | undefined;
      if (!user) return null;

      return {
        user: {
          id: user.id,
          name: user.name?.trim() || user.email,
          email: user.email,
          // An unrecognised role degrades to the least-privileged view rather
          // than throwing a 500 at someone who is legitimately signed in. The
          // backend guard decides what they can actually read either way.
          role: asRole(user.role) ?? 'CUSTOMER',
        },
        stubbed: false,
      };
    } catch {
      // The auth server being unreachable is indistinguishable from being
      // signed out, as far as what this app may show. Fail closed.
      return null;
    }
  },
);
