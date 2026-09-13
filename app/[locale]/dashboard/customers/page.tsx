import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CustomersClient } from './CustomersClient';

/**
 * Every customer, as an administrator sees them.
 *
 * Session and the ADMIN role are enforced by the dashboard layout via
 * ROUTE_ACCESS, and `/customers/admin` is behind the backend's RolesGuard.
 */
export default async function CustomersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('adminCustomers');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </header>
      <CustomersClient />
    </div>
  );
}
