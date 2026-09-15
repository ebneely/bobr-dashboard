import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { isStaff } from '@/lib/auth/roles';
import { getServerSession } from '@/lib/auth/session';
import { dashboardHomePath, dashboardLoginPath, storefrontAccountUrl } from '@/lib/auth/urls';
import { routing } from '@/lib/i18n/routing';

import { StaffOnlyClient } from './StaffOnlyClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'staffOnly' });
  return { title: t('metaTitle') };
}

/**
 * Where the dashboard layout sends a signed-in person who is not staff.
 *
 * Deliberately OUTSIDE app/[locale]/dashboard: nothing of the dashboard — no
 * shell, no nav, no page data — is rendered for them. The client half signs
 * them out, because a customer session has no use on this origin, and points
 * them at the storefront account area where their orders live.
 */
export default async function StaffOnlyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Staff have no business here; send them on rather than signing them out.
  const session = await getServerSession();
  if (session && isStaff(session.user.role)) redirect(dashboardHomePath(locale));

  const tCommon = await getTranslations('common');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <p className="text-center text-2xl font-semibold tracking-tight">{tCommon('appName')}</p>
        <StaffOnlyClient
          signOut={session !== null}
          accountUrl={storefrontAccountUrl(locale)}
          loginPath={dashboardLoginPath(locale)}
        />
      </div>
    </main>
  );
}
