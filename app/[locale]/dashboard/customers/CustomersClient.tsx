'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, formatApiError, type ApiErrorTranslate } from '@/lib/api/client';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import { apiAdminListCustomers, type AdminCustomer } from '@/lib/api/customers';
import { formatWarsawDate } from '@/lib/api/orders';

function describeError(
  error: unknown,
  fallback: string,
  translate: ApiErrorTranslate,
): string {
  if (error instanceof ApiError) return formatApiError(error.body, translate) || fallback;
  return fallback;
}

const headClass =
  'px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase';
const cellClass = 'px-3 py-2.5 align-top';

export function CustomersClient() {
  const t = useTranslations('adminCustomers');
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();

  const [customers, setCustomers] = useState<AdminCustomer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // State is only set from the promise callbacks — see MealsClient for why.
  useEffect(() => {
    let alive = true;
    apiAdminListCustomers()
      .then((rows) => {
        if (alive) setCustomers(rows);
      })
      .catch((err: unknown) => {
        if (alive) {
          setCustomers([]);
          setError(describeError(err, t('loadFailed'), translateApiError));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (customers === null) {
    return (
      <div className="flex flex-col gap-2" aria-label={t('loading')}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
      </Alert>
    );
  }
  if (customers.length === 0) {
    return <p className="text-muted-foreground">{t('none')}</p>;
  }

  return (
    // The table's container scrolls, never the page — a phone gets no
    // sideways body scroll.
    <div className="max-w-full overflow-hidden rounded-lg border bg-card">
      <Table data-testid="customers-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={headClass}>{t('customer')}</TableHead>
            <TableHead className={headClass}>{t('joined')}</TableHead>
            <TableHead className={headClass}>{t('intake')}</TableHead>
            <TableHead className={`${headClass} text-right`}>{t('orders')}</TableHead>
            <TableHead className={headClass}>{t('lastOrder')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.id} data-testid="customer-row" data-email={c.email}>
              <TableCell className={cellClass}>
                {/* `name` is "" when no full name was given; the email stands in. */}
                <div className="font-semibold">{c.name || c.email}</div>
                {c.name && <div className="text-muted-foreground">{c.email}</div>}
              </TableCell>
              <TableCell className={cellClass}>
                {formatWarsawDate(c.createdAt, locale)}
              </TableCell>
              <TableCell className={cellClass} data-testid="customer-intake">
                {c.intakeCompletedAt ? (
                  <>
                    <Badge
                      variant="outline"
                      className="border-primary tracking-wider text-primary uppercase"
                    >
                      {t('yes')}
                    </Badge>{' '}
                    <span className="text-muted-foreground">
                      {formatWarsawDate(c.intakeCompletedAt, locale)}
                    </span>
                  </>
                ) : (
                  <Badge variant="outline" className="tracking-wider uppercase">
                    {t('no')}
                  </Badge>
                )}
              </TableCell>
              <TableCell className={`${cellClass} text-right`} data-testid="customer-orders">
                {c.orderCount}
              </TableCell>
              <TableCell className={cellClass}>
                {c.lastOrderAt ? (
                  formatWarsawDate(c.lastOrderAt, locale)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
