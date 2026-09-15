'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { signOut as authSignOut } from '@/lib/auth/client';

/**
 * The refusal card. Signs the session out once on mount; the card is the same
 * whether or not that succeeds — the dashboard layout refuses the session
 * either way, so a failed revoke leaves nothing reachable.
 */
export function StaffOnlyClient({
  signOut,
  accountUrl,
  loginPath,
}: {
  /** Whether there is a session to end. */
  signOut: boolean;
  accountUrl: string;
  loginPath: string;
}) {
  const t = useTranslations('staffOnly');
  const [signedOut, setSignedOut] = useState(!signOut);

  useEffect(() => {
    if (!signOut) return;
    let alive = true;
    authSignOut()
      .catch(() => undefined)
      .finally(() => {
        if (alive) setSignedOut(true);
      });
    return () => {
      alive = false;
    };
  }, [signOut]);

  return (
    <Card data-testid="staff-only" data-signed-out={signedOut ? 'true' : 'false'}>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
        </CardTitle>
        <CardDescription>{t('body')}</CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        {/* Plain links styled as buttons: the account area is another site, and
            the login page must be a full navigation that re-reads the cookie. */}
        <Button asChild className="w-full sm:w-auto">
          <a href={accountUrl}>{t('account')}</a>
        </Button>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <a href={loginPath}>{t('staffLogin')}</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
