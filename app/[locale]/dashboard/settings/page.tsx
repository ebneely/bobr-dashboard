import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SettingsClient } from './SettingsClient';

/**
 * Shop settings, ADMIN only.
 *
 * The layout has required a session and ROUTE_ACCESS puts this path behind
 * ADMIN; the backend's RolesGuard on /settings/admin/* is the enforcement.
 */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('settingsPage');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>
      <SettingsClient />
    </main>
  );
}
