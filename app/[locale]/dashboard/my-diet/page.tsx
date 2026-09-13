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
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </header>
      <MyDietClient />
    </div>
  );
}
