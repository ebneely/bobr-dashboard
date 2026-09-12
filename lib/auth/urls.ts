import type { Locale } from '@/lib/i18n/routing';

/**
 * The storefront owns sign-in and registration; this app never renders a login
 * form. Both URLs are built here so a deployment that moves the storefront
 * changes one file instead of every redirect site.
 */
const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3100';

/**
 * The storefront login page for `locale`, carrying where the visitor was
 * headed so the storefront can bounce them back after sign-in.
 *
 * The locale segment is spelled out by hand because this is a cross-origin
 * URL: `redirect` from @/lib/i18n/navigation only rewrites paths inside this
 * app, and a bare `/login` here would land on the dashboard's own 404.
 */
export function storefrontLoginUrl(locale: Locale, returnTo?: string): string {
  const url = new URL(`/${locale}/login`, STOREFRONT_URL);
  if (returnTo) url.searchParams.set('redirect', returnTo);
  return url.toString();
}

export function storefrontHomeUrl(locale: Locale): string {
  return new URL(`/${locale}`, STOREFRONT_URL).toString();
}
