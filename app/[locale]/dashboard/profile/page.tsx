import { getTranslations, setRequestLocale } from 'next-intl/server';

import { safeNextPath } from '@/lib/auth/next-path';
import { getServerSession } from '@/lib/auth/session';
import { dashboardHomePath } from '@/lib/auth/urls';
import type { Locale } from '@/lib/i18n/routing';

import { ProfileClient } from './ProfileClient';

/**
 * The signed-in staff member's own account: who they are and a change-password
 * form. Also where the layout holds anyone whose `mustChangePassword` is set —
 * `?next=` is where they were headed, and where they continue afterwards.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('profilePage');
  const tRole = await getTranslations('shell.role');
  const session = await getServerSession();

  const raw = (await searchParams).next;
  const candidate = safeNextPath(Array.isArray(raw) ? raw[0] : raw);
  // Never "continue" back to this page: that would look like nothing happened.
  const next =
    candidate && !/\/dashboard\/profile\/?$/.test(candidate)
      ? candidate
      : dashboardHomePath(locale as Locale);

  // The layout has already redirected anyone without a staff session.
  if (!session) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>
      <ProfileClient
        name={session.user.name}
        email={session.user.email}
        roleLabel={tRole(session.user.role)}
        mustChangePassword={session.user.mustChangePassword}
        next={next}
      />
    </main>
  );
}
