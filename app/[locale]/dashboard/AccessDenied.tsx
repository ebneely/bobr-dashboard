'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <Card className="mx-auto mt-8 max-w-xl">
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('body')}</CardDescription>
      </CardHeader>
      <CardFooter>
        {/* asChild: the Button's styling on a real link, so it navigates and
            can be opened in a new tab rather than being a button that routes. */}
        <Button asChild>
          <Link href={firstAccessibleRoute(role)}>{t('back')}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
