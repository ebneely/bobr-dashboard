import { notFound, redirect } from 'next/navigation';
import { hasLocale } from 'next-intl';

import { getServerSession } from '@/lib/auth/session';
import { dashboardHomePath, dashboardLoginPath } from '@/lib/auth/urls';
import { routing } from '@/lib/i18n/routing';

/**
 * The dashboard has no landing page. Signed in, its root is the dashboard;
 * signed out, the login page — decided here rather than by bouncing through
 * the dashboard layout's gate, so a visitor sees one redirect, not two.
 */
export default async function DashboardRoot({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const session = await getServerSession();
  redirect(session ? dashboardHomePath(locale) : dashboardLoginPath(locale));
}
