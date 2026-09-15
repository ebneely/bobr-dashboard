import { getTranslations, setRequestLocale } from 'next-intl/server';

import { NotesClient } from './NotesClient';

/**
 * Notes: customers raise them on the storefront, staff (ADMIN, SUPER_ADMIN)
 * answer them here. The dashboard layout refuses anyone who is not staff; the
 * backend RolesGuard on the admin endpoints is the enforcement.
 */
export default async function NotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('notesPage');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('queue')}</h1>
      </header>
      <NotesClient />
    </div>
  );
}
