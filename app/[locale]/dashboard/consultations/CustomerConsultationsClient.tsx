'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, formatApiError } from '@/lib/api/client';
import {
  apiListMyConsultations,
  formatWarsawDateTime,
  storefrontConsultationUrl,
  type Consultation,
} from '@/lib/api/consultations';
import { formatGrosze } from '@/lib/api/orders';
import type { Locale } from '@/lib/i18n/routing';

import { ConsultationStatusBadge } from './StatusBadge';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

export function CustomerConsultationsClient() {
  const t = useTranslations('consultationsPage');
  const locale = useLocale();

  const [rows, setRows] = useState<Consultation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiListMyConsultations()
      .then((list) => {
        if (alive) setRows(list);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setRows([]);
        setLoadError(describeError(error, t('loadFailed')));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (rows === null) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('loadFailed')}</AlertTitle>
        <AlertDescription className="whitespace-pre-line">{loadError}</AlertDescription>
      </Alert>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('emptyTitle')}</CardTitle>
          <CardDescription>{t('emptyBody')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <a href={storefrontConsultationUrl(locale as Locale)}>{t('book')}</a>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => {
        const joinable =
          (row.status === 'CONFIRMED' || row.status === 'COMPLETED') &&
          row.meetUrl !== null;
        return (
          <li key={row.id} data-consultation-id={row.id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t(`contexts.${row.context}`)}</CardTitle>
                <CardDescription>
                  {t('price')}: {formatGrosze(row.priceGrosze, locale)}
                </CardDescription>
                <CardAction>
                  <ConsultationStatusBadge status={row.status} />
                </CardAction>
              </CardHeader>

              <CardContent className="flex flex-col gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{t('preferred')}: </span>
                  {formatWarsawDateTime(row.preferredAt, locale)}
                </p>
                {row.scheduledAt ? (
                  <p>
                    <span className="text-muted-foreground">{t('scheduled')}: </span>
                    <span className="font-medium" data-testid="scheduled-at">
                      {formatWarsawDateTime(row.scheduledAt, locale)}
                    </span>
                  </p>
                ) : null}
                {row.note ? (
                  <p className="break-words">
                    <span className="text-muted-foreground">{t('note')}: </span>
                    {row.note}
                  </p>
                ) : null}
                {row.status === 'REQUESTED' ? (
                  <p className="text-muted-foreground">{t('awaiting')}</p>
                ) : null}
              </CardContent>

              {joinable && row.meetUrl ? (
                <CardFooter>
                  <Button asChild>
                    <a href={row.meetUrl} target="_blank" rel="noopener noreferrer">
                      {t('joinMeet')}
                    </a>
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
