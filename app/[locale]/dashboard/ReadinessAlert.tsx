'use client';

import { useTranslations } from 'next-intl';
import { TriangleAlertIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { READINESS_FIX_PATH, useReadiness } from '@/lib/hooks/use-readiness';
import { Link } from '@/lib/i18n/navigation';

/**
 * "The shop cannot sell yet" checklist on the overview (gap G12). Renders
 * nothing when every check passes or is still unknown.
 */
export function ReadinessAlert() {
  const t = useTranslations('readiness');
  const gaps = useReadiness();

  if (gaps.length === 0) return null;

  return (
    <Alert className="border-warning" data-testid="readiness-alert">
      <TriangleAlertIcon className="text-warning" />
      <AlertTitle className="text-base">{t('title')}</AlertTitle>
      <AlertDescription className="text-pretty [&_a]:no-underline">
        <p>{t('body')}</p>
        <ul className="mt-2 flex flex-col gap-2">
          {gaps.map((gap) => (
            <li
              key={gap}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              data-testid={`readiness-${gap}`}
            >
              <span className="text-foreground">{t(`gaps.${gap}`)}</span>
              <Button asChild size="sm" variant="outline" className="w-fit">
                <Link href={READINESS_FIX_PATH[gap]}>{t(`fix.${gap}`)}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
