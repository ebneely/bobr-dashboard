import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ZonesClient } from './ZonesClient';

/**
 * Delivery zones, ADMIN only.
 *
 * The layout has required a session and ROUTE_ACCESS puts this path behind
 * ADMIN; the backend's RolesGuard on /delivery-zones/admin is the enforcement.
 */
export default async function ZonesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('zonesPage');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>
      <ZonesClient />
    </div>
  );
}
