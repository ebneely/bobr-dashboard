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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, formatApiError } from '@/lib/api/client';
import {
  apiListMyConsultations,
  formatWarsawDateTime,
  storefrontConsultationUrl,
  type Consultation,
} from '@/lib/api/consultations';
import { formatGrosze } from '@/lib/api/orders';
import {
  apiGetPaymentSettings,
  formatBlikPhone,
  type PaymentSettings,
} from '@/lib/api/settings';
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
  /** Null until loaded — or when it failed, which reads the same as "not set". */
  const [payment, setPayment] = useState<PaymentSettings | null>(null);

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
    // The BLIK details are secondary: if they fail, unpaid rows fall back to
    // "we will send the details soon" instead of hiding the bookings.
    apiGetPaymentSettings()
      .then((settings) => {
        if (alive) setPayment(settings);
      })
      .catch(() => {
        if (alive) setPayment({ blikPhone: null, blikRecipientName: null });
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

                {row.paidAt ? (
                  <p data-testid="payment-paid">
                    <Badge>{t('paidCustomer')}</Badge>
                  </p>
                ) : row.status !== 'CANCELLED' ? (
                  <BlikInstructions
                    payment={payment}
                    amount={formatGrosze(row.priceGrosze, locale)}
                    reference={row.paymentReference}
                  />
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

/** How to pay an unpaid booking: BLIK to the admin's phone, with the reference. */
function BlikInstructions({
  payment,
  amount,
  reference,
}: {
  payment: PaymentSettings | null;
  amount: string;
  reference: string;
}) {
  const t = useTranslations('consultationsPage');

  if (payment === null) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3" data-testid="payment-blik">
      <p className="font-medium">{t('blikTitle')}</p>
      {payment.blikPhone ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">{t('blikPhone')}</dt>
          <dd className="font-medium tabular-nums" data-testid="blik-phone">
            {formatBlikPhone(payment.blikPhone)}
          </dd>
          {payment.blikRecipientName ? (
            <>
              <dt className="text-muted-foreground">{t('blikName')}</dt>
              <dd className="break-words">{payment.blikRecipientName}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">{t('blikAmount')}</dt>
          <dd className="font-medium">{amount}</dd>
          <dt className="text-muted-foreground">{t('blikReference')}</dt>
          <dd className="font-mono break-all" data-testid="blik-reference">
            {reference}
          </dd>
        </dl>
      ) : (
        <p className="text-muted-foreground" data-testid="blik-pending">
          {t('blikPending')}
        </p>
      )}
    </div>
  );
}
