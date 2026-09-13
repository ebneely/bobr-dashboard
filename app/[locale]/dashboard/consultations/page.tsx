import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getServerSession } from '@/lib/auth/session';

import { CustomerConsultationsClient } from './CustomerConsultationsClient';
import { StaffConsultationsClient } from './StaffConsultationsClient';

/**
 * Consultations, split by role.
 *
 * A CUSTOMER sees their own bookings; ADMIN and DOCTOR see every booking and
 * confirm them. The split is decided here, on the server, from the session —
 * the backend's RolesGuard on /consultations/admin is still the enforcement.
 */
export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('consultationsPage');
  const session = await getServerSession();

  // The layout has already redirected anyone without a session.
  const role = session?.user.role ?? 'CUSTOMER';
  const staff = role === 'ADMIN' || role === 'DOCTOR';

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {staff ? t('subtitleStaff') : t('subtitleCustomer')}
        </p>
      </header>
      {staff ? <StaffConsultationsClient /> : <CustomerConsultationsClient />}
    </main>
  );
}
