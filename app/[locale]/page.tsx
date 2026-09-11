import { redirect } from '@/lib/i18n/navigation';

/** The dashboard has no landing page — its root is the dashboard itself. */
export default async function DashboardRoot({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/dashboard', locale });
}
