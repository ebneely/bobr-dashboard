'use client';

import { useTranslations } from 'next-intl';

import { firstAccessibleRoute, type Role } from '@/lib/auth/roles';
import { Link } from '@/lib/i18n/navigation';

/**
 * Shown in place of the page body when a role reaches a route its own nav
 * never offered — a shared link, a stale bookmark, a typed URL.
 *
 * It renders instead of redirecting because a redirect to "somewhere you are
 * allowed" is a loop waiting to happen the moment two roles disagree about
 * what that is, and it hides from the person that they were refused at all.
 */
export function AccessDenied({ role }: { role: Role }) {
  const t = useTranslations('accessDenied');

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1
        className="mb-3 font-semibold"
        style={{ fontSize: 'var(--bobr-text-2xl)' }}
      >
        {t('title')}
      </h1>
      <p className="mb-6" style={{ color: 'var(--bobr-fg-muted)' }}>
        {t('body')}
      </p>
      <Link
        href={firstAccessibleRoute(role)}
        className="inline-block px-4 py-2 no-underline"
        style={{
          borderRadius: 'var(--bobr-radius-sm)',
          background: 'var(--bobr-accent)',
          color: 'var(--bobr-on-accent)',
          fontSize: 'var(--bobr-text-sm)',
        }}
      >
        {t('back')}
      </Link>
    </main>
  );
}
