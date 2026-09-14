import { getTranslations, setRequestLocale } from 'next-intl/server';

import { MenuAdminClient } from './MenuAdminClient';

/**
 * The menu as staff edit it: the printed PDF or image, and the dishes behind
 * the storefront's /menu page.
 *
 * The dashboard layout has already required a session and ROUTE_ACCESS puts
 * /dashboard/menu behind STAFF, so neither check is repeated here. The
 * backend's RolesGuard on /menu/admin is the enforcement that matters.
 */
export default async function MenuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('menuPage');

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t('subtitle')}</p>
      </header>
      <MenuAdminClient />
    </div>
  );
}
