import { getTranslations, setRequestLocale } from 'next-intl/server';

import { TrackingClient } from './TrackingClient';

/**
 * Meal tracking — the customer's own deliveries.
 *
 * The dashboard layout above this already gated on a session and on role, so
 * this page does not repeat either check. The API scopes every query by the
 * session's user regardless, which is the enforcement that actually matters.
 */
export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('tracking');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <h1 style={{ fontSize: 'var(--bobr-text-h3)', fontWeight: 600 }}>
          {t('title')}
        </h1>
        <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('subtitle')}</p>
      </header>
      <TrackingClient />
    </div>
  );
}
