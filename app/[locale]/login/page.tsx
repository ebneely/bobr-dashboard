import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { safeNextPath } from '@/lib/auth/next-path';
import { getServerSession } from '@/lib/auth/session';
import { dashboardHomePath, storefrontRegisterUrl } from '@/lib/auth/urls';
import { routing } from '@/lib/i18n/routing';

import { LoginClient } from './LoginClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'login' });
  return { title: t('metaTitle') };
}

/**
 * The dashboard's own sign-in page, deliberately OUTSIDE app/[locale]/dashboard
 * so the layout gate there never wraps it.
 *
 * It has to be on this origin: the session cookie is host-only on whichever
 * origin answered the sign-in (ebneely/bobr-dashboard#32), and the browser
 * reaches the API same-origin through the /v1 rewrite in next.config.ts.
 */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Read and validated on the server, so the client only ever receives a path
  // that is already known to be local.
  const raw = (await searchParams).redirect;
  const target = safeNextPath(Array.isArray(raw) ? raw[0] : raw) ?? dashboardHomePath(locale);

  // Already signed in: nothing to do here.
  if (await getServerSession()) redirect(target);

  const tCommon = await getTranslations('common');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <p className="text-center text-2xl font-semibold tracking-tight">{tCommon('appName')}</p>
        <LoginClient target={target} registerUrl={storefrontRegisterUrl(locale)} />
      </div>
    </main>
  );
}
