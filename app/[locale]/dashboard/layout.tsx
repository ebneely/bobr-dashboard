import { notFound, redirect } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { getServerSession } from '@/lib/auth/session';
import { dashboardHomePath, dashboardLoginPath } from '@/lib/auth/urls';
import { routing, type Locale } from '@/lib/i18n/routing';

import { DashboardShell } from './DashboardShell';

/**
 * The authentication gate.
 *
 * It lives in the server layout, not in a client guard and not in proxy.ts:
 *
 * - A client guard renders the page, ships it to the browser, and only then
 *   hides it. The markup — customer names, order totals — has already been
 *   sent. Deciding here means an anonymous request receives a redirect and
 *   nothing else.
 * - proxy.ts runs before the session is known and would need its own round
 *   trip on every asset request. It stays locale-only.
 *
 * Signed-out visitors go to this app's own /{locale}/login, not the
 * storefront's: the session cookie is host-only, so only a sign-in answered on
 * this origin (through the /v1 proxy) produces a cookie this layout can see.
 *
 * `redirect` comes from next/navigation with the locale spelled into the path
 * by hand (lib/auth/urls.ts), so the same helper serves the client sign-out.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const typedLocale = locale as Locale;
  const session = await getServerSession();

  if (!session) {
    redirect(dashboardLoginPath(typedLocale, dashboardHomePath(typedLocale)));
  }

  return (
    <DashboardShell
      userName={session.user.name}
      role={session.user.role}
      stubbed={session.stubbed}
      signOutUrl={dashboardLoginPath(typedLocale)}
    >
      {children}
    </DashboardShell>
  );
}
