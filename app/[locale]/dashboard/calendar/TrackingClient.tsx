'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiListMyOrders,
  apiTrackDay,
  formatGrosze,
  type Order,
  type OrderDay,
} from '@/lib/api/orders';
import { cn } from '@/lib/cn';

export function TrackingClient() {
  const t = useTranslations('tracking');
  const locale = useLocale();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    apiListMyOrders()
      .then(setOrders)
      .catch(() => setError('errors.generic'));
  }, []);

  async function toggle(day: OrderDay) {
    setPending(day.id);
    // Optimistic: the tick responds immediately and is reverted if the write
    // fails. A checkbox that waits for a round trip before moving feels broken
    // even when it is working.
    setOrders((current) =>
      current?.map((order) => ({
        ...order,
        days: order.days.map((d) =>
          d.id === day.id ? { ...d, eaten: !d.eaten } : d,
        ),
      })) ?? current,
    );

    try {
      await apiTrackDay(day.id, !day.eaten);
    } catch {
      setOrders((current) =>
        current?.map((order) => ({
          ...order,
          days: order.days.map((d) =>
            d.id === day.id ? { ...d, eaten: day.eaten } : d,
          ),
        })) ?? current,
      );
      setError('errors.generic');
    } finally {
      setPending(null);
    }
  }

  if (error && !orders) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!orders) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }
  if (orders.length === 0) {
    return <p className="text-muted-foreground">{t('noOrders')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {orders.map((order) => (
        <Card key={order.id} className="gap-4" data-testid="tracking-order">
          <CardHeader className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold">
                {order.meal
                  ? locale === 'pl'
                    ? order.meal.namePl
                    : order.meal.nameEn
                  : '—'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {order.days.length} {t('days')} · {t('status')}: {order.status}
                {order.discountPercent > 0 &&
                  ` · ${t('discount')} ${order.discountPercent}%`}
                {order.shippingGrosze === 0 && ` · ${t('freeShipping')}`}
              </p>
            </div>
            <strong className="text-lg text-primary">
              {formatGrosze(order.totalGrosze, locale)}
            </strong>
          </CardHeader>

          <CardContent>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
              {order.days.map((day) => {
                // The column is a DATE, so it arrives as midnight UTC. Rendering
                // it with the local timezone would shift it a day for anyone west
                // of Greenwich, which is how a delivery lands on the wrong date.
                const label = new Date(day.deliverOn).toLocaleDateString(
                  locale === 'pl' ? 'pl-PL' : 'en-GB',
                  { day: 'numeric', month: 'short', timeZone: 'UTC' },
                );

                return (
                  <li key={day.id}>
                    <Label
                      data-testid="tracking-day"
                      className={cn(
                        'cursor-pointer rounded-lg border px-2.5 py-2.5 font-normal transition-colors',
                        day.eaten
                          ? 'border-transparent bg-foreground text-background'
                          : 'border-border bg-card text-foreground hover:bg-muted',
                        pending === day.id && 'opacity-60',
                      )}
                    >
                      <Checkbox
                        checked={day.eaten}
                        onCheckedChange={() => toggle(day)}
                        aria-label={`${label} — ${day.eaten ? t('eaten') : t('notEaten')}`}
                        className="bg-card data-checked:border-background"
                      />
                      {label}
                    </Label>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
