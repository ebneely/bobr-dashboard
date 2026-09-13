'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, formatApiError } from '@/lib/api/client';
import {
  apiGetMyIntake,
  storefrontIntakeUrl,
  type IntakeProfile,
} from '@/lib/api/intake';
import {
  apiListMyOrders,
  formatGrosze,
  formatWarsawDate,
  type Order,
} from '@/lib/api/orders';
import { cn } from '@/lib/cn';
import { Link } from '@/lib/i18n/navigation';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

/** `undefined` while loading; `null` for "no profile yet", which is not an error. */
type IntakeState = IntakeProfile | null | undefined;

export function MyDietClient() {
  const t = useTranslations('myDiet');

  const [intake, setIntake] = useState<IntakeState>(undefined);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Two independent loads: a failing orders call must not hide the profile,
  // and the other way round.
  useEffect(() => {
    let alive = true;
    apiGetMyIntake()
      .then((profile) => {
        if (alive) setIntake(profile);
      })
      .catch((error: unknown) => {
        if (alive) {
          setIntake(null);
          setIntakeError(describeError(error, t('intakeLoadFailed')));
        }
      });
    apiListMyOrders()
      .then((rows) => {
        if (alive) setOrders(rows);
      })
      .catch((error: unknown) => {
        if (alive) {
          setOrders([]);
          setOrdersError(describeError(error, t('ordersLoadFailed')));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <IntakeSection intake={intake} error={intakeError} />
      <OrdersSection orders={orders} error={ordersError} />
    </div>
  );
}

const MUTED_LABEL = 'text-xs tracking-wider text-muted-foreground uppercase';

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="whitespace-pre-line">{message}</AlertDescription>
    </Alert>
  );
}

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" aria-label={label}>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );
}

function IntakeSection({ intake, error }: { intake: IntakeState; error: string | null }) {
  const t = useTranslations('myDiet');
  const locale = useLocale();
  const numberFormat = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    maximumFractionDigits: 1,
  });

  const complete = Boolean(intake?.completedAt);

  return (
    <Card data-testid="intake-section" className="min-w-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{t('intakeTitle')}</CardTitle>
        {intake !== undefined && !error && (
          <CardAction>
            <Badge
              variant="outline"
              className={cn(
                'tracking-wider uppercase',
                complete ? 'border-primary text-primary' : 'text-muted-foreground',
              )}
              data-testid="intake-status"
            >
              {complete ? t('complete') : t('incomplete')}
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {intake === undefined ? (
          <SectionSkeleton label={t('loading')} />
        ) : error ? (
          <ErrorAlert message={error} />
        ) : (
          <>
            {intake === null ? (
              <p className="text-muted-foreground">{t('noProfile')}</p>
            ) : (
              <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(min(200px,100%),1fr))] gap-4">
                <Fact label={t('weight')}>
                  {t('kg', { value: numberFormat.format(Number(intake.weightKg)) })}
                </Fact>
                <Fact label={t('height')}>
                  {t('cm', { value: numberFormat.format(Number(intake.heightCm)) })}
                </Fact>
                <Fact label={t('bodyComposition')}>
                  {intake.bodyComposition || t('notGiven')}
                </Fact>
                <Fact label={t('activities')}>
                  {intake.activityTypes.length === 0
                    ? t('notGiven')
                    : intake.activityTypes
                        .map((a) =>
                          a === 'OTHER' && intake.activityOther
                            ? `${t('activity.OTHER')}: ${intake.activityOther}`
                            : t(`activity.${a}`),
                        )
                        .join(', ')}
                </Fact>
                {complete && intake.completedAt && (
                  <Fact label={t('completedOn')}>
                    {formatWarsawDate(intake.completedAt, locale)}
                  </Fact>
                )}
                {!complete && intake.missingPhotos.length > 0 && (
                  <Fact label={t('missingPhotos')}>
                    {intake.missingPhotos.map((p) => t(`photo.${p}`)).join(', ')}
                  </Fact>
                )}
              </dl>
            )}

            {!complete && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary p-3">
                <p className="m-0">{t('incompleteHint')}</p>
                {/* A plain <a>: the form is on the storefront, a different origin. */}
                <Button asChild size="lg">
                  <a href={storefrontIntakeUrl(locale)} data-testid="intake-link">
                    {intake === null ? t('startIntake') : t('finishIntake')}
                  </a>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={MUTED_LABEL}>{label}</dt>
      <dd className="mt-1 wrap-anywhere">{children}</dd>
    </div>
  );
}

function OrdersSection({ orders, error }: { orders: Order[] | null; error: string | null }) {
  const t = useTranslations('myDiet');
  const locale = useLocale();

  return (
    <Card data-testid="orders-section" className="min-w-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{t('ordersTitle')}</CardTitle>
        <CardAction>
          <Button asChild variant="outline">
            <Link href="/dashboard/calendar" data-testid="calendar-link">
              {t('trackDays')}
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {orders === null ? (
          <SectionSkeleton label={t('loading')} />
        ) : error ? (
          <ErrorAlert message={error} />
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground">{t('noOrders')}</p>
        ) : (
          // Stacked cards rather than a table: a customer has a handful of
          // orders, and cards read on a phone without any sideways scroll.
          <ul className="flex flex-col gap-2.5">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border p-3"
                data-testid="my-order"
              >
                <div className="min-w-0">
                  <strong className="wrap-anywhere">
                    {order.meal
                      ? locale === 'pl'
                        ? order.meal.namePl
                        : order.meal.nameEn
                      : '—'}
                  </strong>
                  <div className="text-muted-foreground">
                    {t('orderLine', {
                      mode: t(`modes.${order.mode}`),
                      days: order.days.length,
                      date: formatWarsawDate(order.createdAt, locale),
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="tracking-wider uppercase">
                    {t(`statuses.${order.status}`)}
                  </Badge>
                  <strong className="text-lg">
                    {formatGrosze(order.totalGrosze, locale)}
                  </strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
