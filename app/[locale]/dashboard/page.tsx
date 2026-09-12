import { getTranslations, setRequestLocale } from 'next-intl/server';

import { cardsFor } from '@/lib/auth/roles';
import { getServerSession } from '@/lib/auth/session';

/**
 * Placeholder cards, split by role from lib/auth/roles.ts rather than from a
 * fixed list: a customer has no business seeing an "Orders" tile that 404s
 * for them, and an admin has no "My diet".
 *
 * The session is read again here — `getServerSession` is request-cached, so
 * this costs nothing — rather than threaded down from the layout, because a
 * page that depends on the role should say so where it is read.
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
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1
        className="mb-8 font-semibold"
        style={{ fontSize: 'var(--bobr-text-3xl)' }}
      >
        {t('title')}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((key) => (
          <section
            key={key}
            className="p-5"
            style={{
              background: 'var(--bobr-surface)',
              border: '1px solid var(--bobr-border)',
              borderRadius: 'var(--bobr-radius)',
              boxShadow: 'var(--bobr-shadow-sm)',
            }}
          >
            <h2 style={{ fontSize: 'var(--bobr-text-lg)' }}>{t(key)}</h2>
            <p
              className="mt-2"
              style={{
                fontSize: 'var(--bobr-text-sm)',
                color: 'var(--bobr-fg-muted)',
              }}
            >
              —
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
