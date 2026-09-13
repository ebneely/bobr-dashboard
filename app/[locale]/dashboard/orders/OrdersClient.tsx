'use client';

import { useEffect, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, formatApiError } from '@/lib/api/client';
import {
  apiAdminListOrders,
  apiAdminSetOrderStatus,
  formatGrosze,
  formatWarsawDate,
  nextStatuses,
  type AdminOrder,
  type OrderStatus,
} from '@/lib/api/orders';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

const headClass =
  'px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase';

export function OrdersClient() {
  const t = useTranslations('adminOrders');
  // "Tak" / "Nie" for the cancel confirmation. Borrowed rather than added:
  // messages/*.json belong to another stream while this one lands.
  const locale = useLocale();

  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  /** The order waiting on the "cancel for good?" confirmation, if any. */
  const [confirmCancel, setConfirmCancel] = useState<AdminOrder | null>(null);

  // State is only set from the promise callbacks — see MealsClient for why.
  useEffect(() => {
    let alive = true;
    apiAdminListOrders()
      .then((rows) => {
        if (alive) {
          setOrders(rows);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setOrders([]);
          setLoadError(describeError(error, t('loadFailed')));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(order: AdminOrder, status: OrderStatus) {
    // Cancelling is terminal — there is no way back from it — so ask first.
    if (status === 'CANCELLED') {
      setConfirmCancel(order);
      return;
    }
    void move(order, status);
  }

  async function move(order: AdminOrder, status: OrderStatus) {
    setBusyId(order.id);
    setRowError(null);
    try {
      const updated = await apiAdminSetOrderStatus(order.id, status);
      // The PATCH returns the bare row; keep the included user/meal/days.
      setOrders(
        (current) =>
          current?.map((o) =>
            o.id === order.id ? { ...o, status: updated.status } : o,
          ) ?? current,
      );
    } catch (error) {
      setRowError(describeError(error, t('updateFailed')));
    } finally {
      setBusyId(null);
    }
  }

  if (orders === null) {
    return (
      <div className="flex flex-col gap-2" aria-label={t('loading')}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {loadError && (
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-line">{loadError}</AlertDescription>
        </Alert>
      )}
      {rowError && (
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-line">{rowError}</AlertDescription>
        </Alert>
      )}

      {orders.length === 0 && !loadError ? (
        <p className="text-muted-foreground">{t('none')}</p>
      ) : orders.length > 0 ? (
        // The table keeps its natural width; its container scrolls instead of
        // the page, so a phone never gets a sideways-scrolling body.
        <div className="max-w-full overflow-hidden rounded-lg border bg-card">
          <Table data-testid="orders-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={headClass}>{t('customerAddress')}</TableHead>
                <TableHead className={headClass}>{t('meal')}</TableHead>
                <TableHead className={headClass}>{t('mode')}</TableHead>
                <TableHead className={`${headClass} text-right`}>{t('days')}</TableHead>
                <TableHead className={`${headClass} text-right`}>{t('total')}</TableHead>
                <TableHead className={headClass}>{t('status')}</TableHead>
                <TableHead className={headClass}>{t('created')}</TableHead>
                <TableHead className={headClass}>{t('advance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const next = nextStatuses(order.status);
                return (
                  <TableRow
                    key={order.id}
                    data-testid="order-row"
                    data-order-id={order.id}
                  >
                    {/* Who and where in one cell: a separate address column
                        pushed the status actions out of view at 1280px. */}
                    <TableCell className="max-w-64 min-w-48 px-3 py-2.5 align-top whitespace-normal">
                      <div className="font-semibold">{order.user?.fullName ?? '—'}</div>
                      <div className="break-all text-muted-foreground">
                        {order.user?.email ?? ''}
                      </div>
                      <div className="mt-1.5 text-xs" data-testid="order-address">
                        <span className="sr-only">{t('address')}: </span>
                        {order.delivery ? (
                          <>
                            <div className="break-words">{order.delivery.addressLine}</div>
                            <div>
                              {order.delivery.postalCode} {order.delivery.city}
                            </div>
                            <div className="text-muted-foreground">
                              {t('zone', {
                                zone:
                                  locale === 'pl'
                                    ? order.delivery.zoneNamePl
                                    : order.delivery.zoneNameEn,
                              })}
                            </div>
                          </>
                        ) : (
                          // Orders from the old storefront carry no address.
                          <span className="text-muted-foreground">{t('noAddress')}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-32 px-3 py-2.5 align-top whitespace-normal">
                      {order.meal
                        ? locale === 'pl'
                          ? order.meal.namePl
                          : order.meal.nameEn
                        : '—'}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 align-top">
                      {t(`modes.${order.mode}`)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right align-top">
                      {order.days.length}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right align-top font-semibold">
                      {formatGrosze(order.totalGrosze, locale)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 align-top">
                      <Badge
                        variant="outline"
                        className="tracking-wider uppercase"
                        data-testid="order-status"
                      >
                        {t(`statuses.${order.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 align-top">
                      {formatWarsawDate(order.createdAt, locale)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 align-top">
                      {next.length === 0 ? (
                        <span className="text-muted-foreground">{t('final')}</span>
                      ) : (
                        // One compact trigger per row instead of a button per
                        // legal status: two buttons side by side pushed the
                        // last one ("Anuluj") out of view at 1280px.
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyId === order.id}
                              data-testid="order-actions"
                            >
                              {t('advance')}
                              <ChevronDownIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-auto">
                            {next.map((status) => (
                              <DropdownMenuItem
                                key={status}
                                variant={status === 'CANCELLED' ? 'destructive' : 'default'}
                                onSelect={() => choose(order, status)}
                                data-testid={`move-${status}`}
                              >
                                {t(`moveTo.${status}`)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <AlertDialog
        open={confirmCancel !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('moveTo.CANCELLED')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cancelConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancelBack')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="confirm-cancel"
              onClick={() => {
                if (confirmCancel) void move(confirmCancel, 'CANCELLED');
              }}
            >
              {t('cancelYes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
