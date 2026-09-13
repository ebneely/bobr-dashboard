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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
      <header>
        <h1 style={{ fontSize: 'var(--bobr-text-2xl)', fontWeight: 600 }}>
          {t('title')}
        </h1>
        <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('subtitle')}</p>
      </header>
      <OrdersClient />
    </div>
  );
}
