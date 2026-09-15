import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

import { CustomerDetailClient } from './CustomerDetailClient';

/**
 * One customer's full profile for the doctor (gap G16): intake, orders,
 * notes, consultations, weight history. The dashboard layout has already
 * required a staff session; the backend's `GET /v1/customers/admin/:id`
 * (STAFF only) is the real enforcement, 404 `CUSTOMER_NOT_FOUND` otherwise.
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('customerDetail');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button asChild variant="link" className="h-auto w-fit p-0">
          <Link href="/dashboard/customers">{t('back')}</Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      </header>
      <CustomerDetailClient id={id} />
    </div>
  );
}
