import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { safeNextPath } from '@/lib/auth/next-path';
import { isStaff, mustLeaveForPasswordChange } from '@/lib/auth/roles';
import { getServerSession } from '@/lib/auth/session';
import {
  PATHNAME_HEADER,
  dashboardHomePath,
  dashboardLoginPath,
  dashboardProfilePath,
  staffOnlyPath,
  stripLocale,
} from '@/lib/auth/urls';
import { routing, type Locale } from '@/lib/i18n/routing';

import { DashboardShell } from './DashboardShell';

/**
 * The authentication gate. Three checks, in order, each a redirect so that
 * nothing under /dashboard is rendered for someone who fails it:
 *
 * 1. No session → this app's own /{locale}/login, carrying the requested page
 *    (read from the header proxy.ts stamps) so a deep link survives sign-in.
 * 2. A session that is not staff → /{locale}/staff-only, which signs them out
 *    and says the panel is for the BOBR team. The dashboard is staff-only
 *    (ebneely/bobr-dashboard#38); customers use the storefront account area.
 * 3. `mustChangePassword` → the change-password page, until it is changed.
 *
 * It lives in the server layout, not in a client guard and not in proxy.ts:
 * a client guard ships the markup before hiding it, and proxy.ts runs before
 * the session is known. A layout does not re-render on in-app navigation, so
 * DashboardShell repeats check 3 on the client; checks 1 and 2 cannot change
 * without a full navigation (sign-in and sign-out both do one).
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

  // Only a local page in a known locale survives safeNextPath. Without the
  // header (a request proxy.ts did not see) the pathname is unknown.
  const knownPath = safeNextPath((await headers()).get(PATHNAME_HEADER));
  const requested = knownPath ?? dashboardHomePath(typedLocale);

  if (!session) {
    redirect(dashboardLoginPath(typedLocale, requested));
  }

  if (!isStaff(session.user.role)) {
    redirect(staffOnlyPath(typedLocale));
  }

  // Only on a known path: redirecting from an unknown one could be redirecting
  // the profile page to itself. DashboardShell holds the line client-side.
  if (knownPath && mustLeaveForPasswordChange(stripLocale(knownPath), session.user.mustChangePassword)) {
    redirect(dashboardProfilePath(typedLocale, knownPath));
  }

  return (
    <DashboardShell
      userName={session.user.name}
      role={session.user.role}
      stubbed={session.stubbed}
      mustChangePassword={session.user.mustChangePassword}
      signOutUrl={dashboardLoginPath(typedLocale)}
    >
      {children}
    </DashboardShell>
  );
}
