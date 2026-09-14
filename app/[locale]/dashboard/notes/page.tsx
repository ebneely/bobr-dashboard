import { getTranslations, setRequestLocale } from 'next-intl/server';

import { isStaff } from '@/lib/auth/roles';
import { getServerSession } from '@/lib/auth/session';
import { NotesClient } from './NotesClient';

/**
 * Notes: the customer raises them, staff (ADMIN, SUPER_ADMIN) answer them.
 *
 * The role is read SERVER-side and passed down, so the staff queue is never
 * shipped to a customer's browser at all. The backend RolesGuard refuses the
 * admin endpoints regardless — this only decides which UI is rendered.
 */
export default async function NotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('notesPage');
  const session = await getServerSession();
  const isAdmin = isStaff(session?.user.role);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {isAdmin ? t('queue') : t('title')}
        </h1>
        {!isAdmin && (
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        )}
      </header>
      <NotesClient isAdmin={isAdmin} />
    </div>
  );
}
