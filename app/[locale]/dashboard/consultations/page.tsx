import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StaffConsultationsClient } from './StaffConsultationsClient';

/**
 * Consultations: every booking, confirmed and marked paid by staff (ADMIN,
 * SUPER_ADMIN). Customers see their own bookings in the storefront account
 * area. The dashboard layout refuses non-staff; the backend's RolesGuard on
 * /consultations/admin is the enforcement.
 */
export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('consultationsPage');

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitleStaff')}</p>
      </header>
      {/* Every staff role marks payments; the backend's STAFF_ROLES guard agrees. */}
      <StaffConsultationsClient canMarkPaid />
    </main>
  );
}
