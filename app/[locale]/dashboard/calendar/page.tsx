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
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </header>
      <TrackingClient />
    </div>
  );
}
