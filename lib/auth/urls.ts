import type { Locale } from '@/lib/i18n/routing';

/**
 * Sign-in lives in this app (/{locale}/login); registration stays on the
 * storefront. Both are built here so a deployment that moves either changes
 * one file instead of every redirect site.
 *
 * Sign-in cannot live on the storefront: the session cookie is host-only on
 * whichever origin answered the sign-in, and vercel.app is on the Public Suffix
 * List, so a cookie the storefront receives never reaches this origin
 * (ebneely/bobr-dashboard#32).
 */
const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3100';

/**
 * This app's login page for `locale`, carrying where the visitor was headed.
 *
 * A plain path with the locale spelled out, so it works both with the
 * next/navigation `redirect` in a server layout and `window.location` in a
 * client component. `returnTo` is re-validated by the login page anyway.
 */
export function dashboardLoginPath(locale: Locale, returnTo?: string): string {
  const path = `/${locale}/login`;
  return returnTo ? `${path}?redirect=${encodeURIComponent(returnTo)}` : path;
}

/** Where a signed-in visitor goes when nothing better was asked for. */
export function dashboardHomePath(locale: Locale): string {
  return `/${locale}/dashboard`;
}

/** The storefront registration page — this app has no sign-up form. */
export function storefrontRegisterUrl(locale: Locale): string {
  return new URL(`/${locale}/register`, STOREFRONT_URL).toString();
}
