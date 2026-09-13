import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTE_ACCESS, cardsFor } from '@/lib/auth/roles';
import { getServerSession } from '@/lib/auth/session';
import { Link } from '@/lib/i18n/navigation';

/**
 * Where each overview card leads. Most cards share their message key with a
 * route in ROUTE_ACCESS; meal tracking lives on the calendar page.
 */
function hrefFor(key: string): string {
  if (key === 'mealTracking') return '/dashboard/calendar';
  return ROUTE_ACCESS.find((rule) => rule.messageKey === key)?.path ?? '/dashboard';
}

/**
 * The overview: one card per area this role can use, split by role from
 * lib/auth/roles.ts rather than from a fixed list — a customer has no business
 * seeing an "Orders" tile, and an admin has no "My diet".
 *
 * Each card is a link to its page. They used to be placeholders showing "—",
 * from before those pages existed.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');
  const session = await getServerSession();

  // The layout above has already redirected anyone without a session, so this
  // branch is only reachable in the instant between the two renders.
  const cards = session ? cardsFor(session.user.role) : [];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((key) => (
          <li key={key}>
            <Link
              href={hrefFor(key)}
              className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors group-hover:border-highlight">
                <CardHeader>
                  <CardTitle className="text-lg">{t(key)}</CardTitle>
                  <CardDescription>{t(`hints.${key}`)}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
