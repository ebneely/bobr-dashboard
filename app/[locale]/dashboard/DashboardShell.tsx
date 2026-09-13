'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { signOut } from '@/lib/auth/client';
import { canAccess, navItemsFor, ruleFor, type Role } from '@/lib/auth/roles';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/cn';

import { AccessDenied } from './AccessDenied';

export function DashboardShell({
  userName,
  role,
  stubbed,
  signOutUrl,
  children,
}: {
  userName: string;
  role: Role;
  stubbed: boolean;
  signOutUrl: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('shell');
  const tNav = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  // `usePathname` from @/lib/i18n/navigation returns the path with the locale
  // segment already stripped, which is the shape lib/auth/roles.ts keys on.
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const items = navItemsFor(role);
  const allowed = canAccess(pathname, role);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // A failed revoke must not strand someone on a page they think is
      // signed out. Leave for the storefront either way; the cookie is
      // httpOnly and the next server render re-checks it.
    }
    // Full navigation, not the router: the destination is another origin.
    window.location.href = signOutUrl;
  }

  return (
    <div className="md:grid md:min-h-screen md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside
        className="flex flex-col gap-4 px-4 py-4 md:sticky md:top-0 md:h-screen md:py-6"
        style={{
          background: 'var(--bobr-surface)',
          borderBottom: '1px solid var(--bobr-border)',
          borderRight: '1px solid var(--bobr-border)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="font-semibold"
            style={{ fontSize: 'var(--bobr-text-xl)' }}
          >
            {tCommon('appName')}
          </span>
          <span
            className="px-2 py-1"
            style={{
              fontSize: 'var(--bobr-text-xs)',
              borderRadius: 'var(--bobr-radius-sm)',
              background: 'var(--bobr-surface-sunken)',
              color: 'var(--bobr-fg-muted)',
            }}
          >
            {t(`role.${role}`)}
          </span>
        </div>

        <nav aria-label={t('navLabel')}>
          <ul className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
            {items.map((item) => {
              // Only the MOST SPECIFIC matching route is active. A prefix match
              // made /dashboard active on every page beneath it, so two items
              // lit up at once.
              const active = ruleFor(pathname)?.path === item.path;
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    aria-current={active ? 'page' : undefined}
                    className={cn('block px-3 py-2 no-underline')}
                    style={{
                      fontSize: 'var(--bobr-text-sm)',
                      borderRadius: 'var(--bobr-radius-sm)',
                      background: active ? 'var(--bobr-accent)' : 'transparent',
                      color: active
                        ? 'var(--bobr-on-accent)'
                        : 'var(--bobr-fg)',
                      transition: `background var(--bobr-duration) var(--bobr-ease)`,
                    }}
                  >
                    {tNav(item.messageKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="min-w-0">
            <p
              style={{
                fontSize: 'var(--bobr-text-xs)',
                color: 'var(--bobr-fg-muted)',
              }}
            >
              {t('signedInAs')}
            </p>
            <p className="truncate" style={{ fontSize: 'var(--bobr-text-sm)' }}>
              {userName}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="px-3 py-2"
            style={{
              fontSize: 'var(--bobr-text-sm)',
              borderRadius: 'var(--bobr-radius-sm)',
              border: '1px solid var(--bobr-border)',
              background: 'var(--bobr-surface-sunken)',
              color: 'var(--bobr-fg)',
              cursor: signingOut ? 'progress' : 'pointer',
            }}
          >
            {signingOut ? t('signingOut') : tCommon('logout')}
          </button>
        </div>

        {stubbed ? (
          <p
            style={{
              fontSize: 'var(--bobr-text-xs)',
              color: 'var(--bobr-warning)',
            }}
          >
            {t('stubbedSession')}
          </p>
        ) : null}
      </aside>

      {/* `min-w-0` so a wide child (a table) scrolls inside itself instead of
          stretching the grid column and giving the whole page a sideways
          scrollbar on a phone. */}
      <div className="min-w-0">
        {allowed ? children : <AccessDenied role={role} />}
      </div>
    </div>
  );
}
