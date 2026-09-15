import type { Locale } from '@/lib/i18n/routing';

/**
 * Every place this app sends someone, built in one file so a deployment that
 * moves any of them changes one line instead of every redirect site.
 *
 * There is no sign-up anywhere in the dashboard: staff accounts are created by
 * a SUPER_ADMIN (ebneely/bobr-dashboard#36), and a storefront sign-up is always
 * a customer account.
 *
 * Sign-in cannot live on the storefront: the session cookie is host-only on
 * whichever origin answered the sign-in, and vercel.app is on the Public Suffix
 * List, so a cookie the storefront receives never reaches this origin
 * (ebneely/bobr-dashboard#32).
 */
const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3100';

/**
 * The request header proxy.ts stamps with the requested pathname, so a server
 * layout — which Next gives no pathname — can keep a deep link through sign-in
 * and the change-password gate.
 */
export const PATHNAME_HEADER = 'x-pathname';

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

/**
 * The change-password page, carrying where the person was headed so they
 * continue there once the password is changed.
 */
export function dashboardProfilePath(locale: Locale, returnTo?: string): string {
  const path = `/${locale}/dashboard/profile`;
  return returnTo ? `${path}?next=${encodeURIComponent(returnTo)}` : path;
}

/**
 * Where a signed-in non-staff person is sent: outside the dashboard layout, so
 * nothing under /dashboard renders for them at all.
 */
export function staffOnlyPath(locale: Locale): string {
  return `/${locale}/staff-only`;
}

/** The storefront account area, where customers manage their orders. */
export function storefrontAccountUrl(locale: Locale): string {
  return new URL(`/${locale}/account`, STOREFRONT_URL).toString();
}

/** "/pl/dashboard/orders" → "/dashboard/orders"; the shape roles.ts keys on. */
export function stripLocale(pathname: string): string {
  const stripped = pathname.replace(/^\/(pl|en)(?=\/|$)/, '');
  return stripped === '' ? '/' : stripped;
}
