import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getServerSession } from '@/lib/auth/session';

import { StaffClient } from './StaffClient';

/**
 * Staff accounts, SUPER_ADMIN only (ebneely/bobr-dashboard#36).
 *
 * ROUTE_ACCESS puts this path behind SUPER_ADMIN, so an ADMIN gets the shell's
 * AccessDenied card; the backend's `@Roles(Role.SUPER_ADMIN)` is the
 * enforcement.
 */
export default async function StaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('staffPage');
  const session = await getServerSession();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>
      <StaffClient selfId={session?.user.id ?? ''} />
    </main>
  );
}
