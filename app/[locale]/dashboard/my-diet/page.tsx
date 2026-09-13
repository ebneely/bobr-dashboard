import { getTranslations, setRequestLocale } from 'next-intl/server';

import { MyDietClient } from './MyDietClient';

/**
 * The customer's own diet: their intake profile and their orders.
 *
 * The dashboard layout has already required a session and ROUTE_ACCESS limits
 * /dashboard/my-diet to CUSTOMER, so neither is re-checked here. Both endpoints
 * are `/me`-scoped by the session server-side.
 */
export default async function MyDietPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('myDiet');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
      <header>
        <h1 style={{ fontSize: 'var(--bobr-text-2xl)', fontWeight: 600 }}>
          {t('title')}
        </h1>
        <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('subtitle')}</p>
      </header>
      <MyDietClient />
    </div>
  );
}
