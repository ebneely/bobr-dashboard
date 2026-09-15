'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { signOut } from '@/lib/auth/client';
import {
  PASSWORD_CHANGE_PATH,
  canAccess,
  mustLeaveForPasswordChange,
  navItemsFor,
  ruleFor,
  type Role,
} from '@/lib/auth/roles';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';

import { AccessDenied } from './AccessDenied';

export function DashboardShell({
  userName,
  role,
  stubbed,
  mustChangePassword,
  signOutUrl,
  children,
}: {
  userName: string;
  role: Role;
  stubbed: boolean;
  /** Held on the change-password page until it is changed (dashboard#36). */
  mustChangePassword: boolean;
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

  const router = useRouter();

  // While a password must be changed there is nowhere else to go, so the nav
  // is not offered at all.
  const items = mustChangePassword ? [] : navItemsFor(role);
  const allowed = canAccess(pathname, role);

  // The server layout redirects on a full load, but a layout does not
  // re-render on in-app navigation — this catches the rest.
  const held = mustLeaveForPasswordChange(pathname, mustChangePassword);
  useEffect(() => {
    if (held) router.replace(PASSWORD_CHANGE_PATH);
  }, [held, router]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // A failed revoke must not strand someone on a page they think is
      // signed out. Leave for the login page either way; the cookie is
      // httpOnly and the next server render re-checks it.
    }
    // Full navigation, not the router: the server layouts must re-read the
    // (now cleared) cookie on a real request, and no cached RSC payload of a
    // signed-in page may survive.
    window.location.href = signOutUrl;
  }

  return (
    <div className="md:grid md:min-h-screen md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 border-b bg-sidebar px-4 py-4 text-sidebar-foreground md:sticky md:top-0 md:h-screen md:border-r md:border-b-0 md:py-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xl font-semibold tracking-tight">
            {tCommon('appName')}
          </span>
          <Badge variant="secondary">{t(`role.${role}`)}</Badge>
        </div>

        {mustChangePassword ? (
          <p className="text-sm text-muted-foreground" data-testid="password-change-note">
            {t('passwordChangeRequired')}
          </p>
        ) : null}

        <nav aria-label={t('navLabel')}>
          <ul className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
            {items.map((item) => {
              // Only the MOST SPECIFIC matching route is active. A prefix match
              // made /dashboard active on every page beneath it, so two items
              // lit up at once.
              const active = ruleFor(pathname)?.path === item.path;
              return (
                <li key={item.path}>
                  <Button
                    asChild
                    variant={active ? 'default' : 'ghost'}
                    className="w-full justify-start"
                  >
                    <Link
                      href={item.path}
                      aria-current={active ? 'page' : undefined}
                    >
                      {tNav(item.messageKey)}
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </nav>

        <Separator className="mt-auto" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t('signedInAs')}</p>
            <Button asChild variant="link" className="h-auto max-w-full justify-start p-0">
              <Link href={PASSWORD_CHANGE_PATH} data-testid="profile-link">
                <span className="truncate text-sm">{userName}</span>
              </Link>
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? t('signingOut') : tCommon('logout')}
          </Button>
        </div>

        {stubbed ? (
          <p className="text-xs text-warning">{t('stubbedSession')}</p>
        ) : null}
      </aside>

      {/* `min-w-0` so a wide child (a table) scrolls inside itself instead of
          stretching the grid column and giving the whole page a sideways
          scrollbar on a phone. The gutter lives here, once, for every page. */}
      <div className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        {held ? null : allowed ? children : <AccessDenied role={role} />}
      </div>
    </div>
  );
}
