import { getTranslations, setRequestLocale } from 'next-intl/server';

import { OrdersClient } from './OrdersClient';

/**
 * Every order, as an administrator sees it.
 *
 * The dashboard layout has already required a session, and ROUTE_ACCESS puts
 * /dashboard/orders behind ADMIN — so neither check is repeated here. The
 * backend's RolesGuard on `/orders/admin` is the enforcement that matters.
 */
export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('adminOrders');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </header>
      <OrdersClient />
    </div>
  );
}
