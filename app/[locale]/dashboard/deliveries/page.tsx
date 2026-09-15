import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DeliveriesClient } from './DeliveriesClient';

/**
 * The kitchen's production list and the courier's stop list for one day
 * (gap G13). The dashboard layout has already required a staff session, and
 * ROUTE_ACCESS puts /dashboard/deliveries behind STAFF — the backend's
 * RolesGuard on `/deliveries/admin` is the enforcement that matters.
 */
export default async function DeliveriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('deliveriesPage');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="print:hidden">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </header>
      <DeliveriesClient />
    </div>
  );
}
