import { getTranslations, setRequestLocale } from 'next-intl/server';

/**
 * Placeholder shell. What actually goes here — meal tracking, the calendar,
 * orders, consultations, notes — depends on the business-logic conversation
 * still to be had, and on whether this surface is customer-facing,
 * admin-facing or both (see the open questions in ../../docs/SPEC.md).
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');

  const sections = [
    'myDiet',
    'mealTracking',
    'calendar',
    'orders',
    'consultations',
    'notes',
  ] as const;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1
        className="mb-8 font-semibold"
        style={{ fontSize: 'var(--bobr-text-3xl)' }}
      >
        {t('title')}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((key) => (
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
