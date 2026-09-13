import { getTranslations, setRequestLocale } from 'next-intl/server';

import { MealsClient } from './MealsClient';

/**
 * The meal catalogue, as an administrator sees it.
 *
 * The dashboard layout above this has already required a session, and
 * ROUTE_ACCESS puts /dashboard/meals behind ADMIN — so this page repeats
 * neither check. The backend's RolesGuard refuses `/meals/admin` to anyone
 * else regardless, which is the enforcement that actually matters; everything
 * here only decides what a person is shown.
 */
export default async function MealsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('adminMeals');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </header>
      <MealsClient />
    </div>
  );
}
