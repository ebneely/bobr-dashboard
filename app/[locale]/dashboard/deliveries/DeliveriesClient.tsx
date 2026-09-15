'use client';

import { useEffect, useId, useState } from 'react';
import { PrinterIcon } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { Allergen } from '@/lib/api/menu';
import type { MealType } from '@/lib/api/orders';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, formatApiError, type ApiErrorTranslate } from '@/lib/api/client';
import {
  apiAdminListDeliveries,
  apiSetDeliveryDayStatus,
  DAY_TRANSITIONS,
  warsawTodayIso,
  warsawTomorrowIso,
  type AdminDeliveriesView,
  type DeliveryDayStatus,
  type DeliveryStop,
} from '@/lib/api/deliveries';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import { formatGrosze } from '@/lib/api/orders';

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

export function DeliveriesClient() {
  const t = useTranslations('deliveriesPage');
  const tMealTypes = useTranslations('adminMeals.types');
  const tAllergens = useTranslations('menuPage.allergens');
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();
  const fieldId = useId();

  const [date, setDate] = useState(() => warsawTomorrowIso());
  const [view, setView] = useState<AdminDeliveriesView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyDayId, setBusyDayId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  /** The stop waiting on the "mark delivered" confirmation, if any. */
  const [confirmDeliver, setConfirmDeliver] = useState<DeliveryStop | null>(null);
  /** The stop currently filling in a fail reason. */
  const [failing, setFailing] = useState<DeliveryStop | null>(null);
  const [failReason, setFailReason] = useState('');
  const [failError, setFailError] = useState<string | null>(null);

  function load(forDate: string) {
    apiAdminListDeliveries(forDate)
      .then((data) => {
        setView(data);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        setView({ date: forDate, production: [], stops: [] });
        setLoadError(describeError(error, t('loadFailed'), translateApiError));
      });
  }

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function setStatus(stop: DeliveryStop, status: DeliveryDayStatus, reason?: string) {
    setBusyDayId(stop.orderDayId);
    setRowError(null);
    try {
      await apiSetDeliveryDayStatus(stop.orderDayId, { status, failReason: reason });
      load(date);
    } catch (error) {
      setRowError(describeError(error, t('updateFailed'), translateApiError));
      throw error;
    } finally {
      setBusyDayId(null);
    }
  }

  function openFail(stop: DeliveryStop) {
    setFailing(stop);
    setFailReason('');
    setFailError(null);
  }

  async function submitFail() {
    if (!failing) return;
    if (!failReason.trim()) {
      setFailError(t('failReasonRequired'));
      return;
    }
    try {
      await setStatus(failing, 'FAILED', failReason.trim());
      setFailing(null);
    } catch (error) {
      setFailError(describeError(error, t('updateFailed'), translateApiError));
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 print:gap-2">
      {/* Hidden on paper: the date picker and print button are controls, not content. */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldId}-date`}>{t('date')}</Label>
          <Input
            id={`${fieldId}-date`}
            type="date"
            min={warsawTodayIso()}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-48"
            data-testid="deliveries-date"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <PrinterIcon />
          {t('print')}
        </Button>
      </div>

      {/* Printed header: the on-screen date field is hidden, so paper needs its own. */}
      <p className="hidden text-lg font-semibold print:block">{date}</p>

      {loadError && (
        <Alert variant="destructive" className="print:hidden">
          <AlertDescription className="whitespace-pre-line">{loadError}</AlertDescription>
        </Alert>
      )}
      {rowError && (
        <Alert variant="destructive" className="print:hidden">
          <AlertDescription className="whitespace-pre-line">{rowError}</AlertDescription>
        </Alert>
      )}

      {view === null ? (
        <div className="flex flex-col gap-2" aria-label={t('loading')}>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="kitchen" className="print:block">
          <TabsList className="print:hidden">
            <TabsTrigger value="kitchen" data-testid="tab-kitchen">
              {t('kitchen')}
            </TabsTrigger>
            <TabsTrigger value="couriers" data-testid="tab-couriers">
              {t('couriers')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kitchen" className="print:block" data-testid="kitchen-panel">
            {view.production.length === 0 ? (
              <p className="text-muted-foreground">{t('noProduction')}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {view.production.map((row) => (
                  <li key={row.mealId}>
                    <Card size="sm">
                      <CardContent className="flex flex-col gap-1.5">
                        <span className="text-xs tracking-wider text-muted-foreground uppercase">
                          {tMealTypes(row.type as MealType)}
                        </span>
                        <strong className="text-lg wrap-anywhere">{row.namePl}</strong>
                        <span className="text-2xl font-semibold" data-testid="production-count">
                          {t('portions', { count: row.count })}
                        </span>
                        {row.allergens.length > 0 && (
                          <div
                            className="mt-1 flex flex-wrap gap-1"
                            data-testid="production-allergens"
                          >
                            {row.allergens.map((a) => (
                              <Badge key={a} variant="outline" className="text-xs">
                                {tAllergens(a as Allergen)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="couriers" className="print:block" data-testid="couriers-panel">
            {view.stops.length === 0 ? (
              <p className="text-muted-foreground">{t('noStops')}</p>
            ) : (
              <div className="max-w-full overflow-x-auto rounded-lg border bg-card print:overflow-visible print:border-none">
                <Table data-testid="stops-table">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className={headClass}>{t('customer')}</TableHead>
                      <TableHead className={headClass}>{t('phone')}</TableHead>
                      <TableHead className={headClass}>{t('address')}</TableHead>
                      <TableHead className={headClass}>{t('zone')}</TableHead>
                      <TableHead className={headClass}>{t('notes')}</TableHead>
                      <TableHead className={headClass}>{t('status')}</TableHead>
                      <TableHead className={`${headClass} print:hidden`}>
                        {t('actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.stops.map((stop) => {
                      const legal = DAY_TRANSITIONS[stop.dayStatus];
                      return (
                        <TableRow
                          key={stop.orderDayId}
                          data-testid="stop-row"
                          data-order-day-id={stop.orderDayId}
                        >
                          <TableCell className={cellClass}>
                            <div className="font-semibold">{stop.customerName}</div>
                            <div className="text-muted-foreground">
                              {stop.mealNamePl}
                              {stop.orderPending && (
                                <Badge variant="outline" className="ml-1.5 text-xs">
                                  {t('orderPending')}
                                </Badge>
                              )}
                            </div>
                            {stop.allergens.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {stop.allergens.map((a) => (
                                  <Badge key={a} variant="outline" className="text-xs">
                                    {a}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={cellClass}>
                            {stop.phone ? (
                              <a href={`tel:${stop.phone}`} className="text-primary underline">
                                {stop.phone}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className={cellClass}>
                            {stop.addressLine ? (
                              <>
                                <div className="break-words">{stop.addressLine}</div>
                                <div>
                                  {stop.postalCode} {stop.city}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground">{t('noAddress')}</span>
                            )}
                          </TableCell>
                          <TableCell className={cellClass}>
                            {stop.zoneNamePl ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className={`${cellClass} max-w-48 whitespace-normal`}>
                            {stop.deliveryNotes ?? ''}
                            {stop.codToCollectGrosze != null && (
                              <div className="mt-1 font-semibold" data-testid="cod-amount">
                                {t('codToCollect', {
                                  amount: formatGrosze(stop.codToCollectGrosze, locale),
                                })}
                              </div>
                            )}
                            {stop.paid && (
                              <Badge
                                variant="outline"
                                className="mt-1 border-primary text-primary"
                              >
                                {t('paid')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className={cellClass}>
                            <Badge
                              variant="outline"
                              className="tracking-wider uppercase"
                              data-testid="day-status"
                            >
                              {t(`dayStatuses.${stop.dayStatus}`)}
                            </Badge>
                          </TableCell>
                          <TableCell className={`${cellClass} print:hidden`}>
                            {stop.orderPending ? (
                              // The order itself is not CONFIRMED yet — the
                              // backend refuses DELIVERED/FAILED on its days
                              // with ORDER_NOT_DELIVERABLE, so do not offer
                              // an action that would only ever 409.
                              <span className="text-muted-foreground">{t('orderPending')}</span>
                            ) : legal.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {legal.includes('DELIVERED') && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={busyDayId === stop.orderDayId}
                                    onClick={() => setConfirmDeliver(stop)}
                                    data-testid="mark-delivered"
                                  >
                                    {t('markDelivered')}
                                  </Button>
                                )}
                                {legal.includes('FAILED') && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    disabled={busyDayId === stop.orderDayId}
                                    onClick={() => openFail(stop)}
                                    data-testid="mark-failed"
                                  >
                                    {t('markFailed')}
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog
        open={confirmDeliver !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeliver(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('markDelivered')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeliver ? t('deliverConfirm', { name: confirmDeliver.customerName }) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delivered"
              onClick={() => {
                if (confirmDeliver) {
                  void setStatus(confirmDeliver, 'DELIVERED').catch(() => undefined);
                }
                setConfirmDeliver(null);
              }}
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={failing !== null}
        onOpenChange={(open) => {
          if (!open) setFailing(null);
        }}
      >
        <DialogContent data-testid="fail-dialog">
          <DialogHeader>
            <DialogTitle>{t('markFailed')}</DialogTitle>
            <DialogDescription>
              {failing ? t('failDescription', { name: failing.customerName }) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`${fieldId}-fail-reason`}>{t('failReason')}</Label>
            <Textarea
              id={`${fieldId}-fail-reason`}
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              rows={3}
              maxLength={500}
              data-testid="fail-reason-input"
            />
          </div>
          {failError && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-line">{failError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFailing(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void submitFail()}
              disabled={busyDayId === failing?.orderDayId}
              data-testid="submit-fail"
            >
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
