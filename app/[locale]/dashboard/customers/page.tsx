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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
      <header>
        <h1 style={{ fontSize: 'var(--bobr-text-2xl)', fontWeight: 600 }}>
          {t('title')}
        </h1>
        <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('subtitle')}</p>
      </header>
      <CustomersClient />
    </div>
  );
}
