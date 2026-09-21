'use client';

import { useEffect, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, formatApiError, type ApiErrorTranslate } from '@/lib/api/client';
import { apiRecordDeliveryPayment } from '@/lib/api/deliveries';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import {
  ADJUST_NOTE_MAX,
  CANCEL_REASON_MAX,
  CANCEL_REASON_MIN,
  apiAdminAdjustOrderTotal,
  apiAdminListOrders,
  apiAdminSetOrderStatus,
  formatGrosze,
  formatWarsawDate,
  groszeToZloteInput,
  nextStatuses,
  zloteToGrosze,
  type AdminOrder,
  type OrderStatus,
} from '@/lib/api/orders';

function describeError(
  error: unknown,
  fallback: string,
  translate: ApiErrorTranslate,
): string {
  if (error instanceof ApiError) return formatApiError(error.body, translate) || fallback;
  return fallback;
}

/** 409 ORDER_CHANGED: the order moved underneath us (compare-and-set lost). */
function isOrderChanged(error: unknown): boolean {
  return error instanceof ApiError && error.body?.code === 'ORDER_CHANGED';
}

/** A total can be adjusted only while the order is live and not yet settled. */
function canAdjustTotal(order: AdminOrder): boolean {
  return order.status !== 'CANCELLED' && !order.paidAt;
}

/**
 * Folds a PATCH answer into the listed row. The PATCH returns the bare order
 * row; the list's included user/meal/days/delivery are kept from what we had.
 */
function mergeRow(current: AdminOrder, updated: AdminOrder): AdminOrder {
  return {
    ...current,
    ...updated,
    user: current.user,
    meal: current.meal ?? updated.meal,
    days: current.days,
    delivery: current.delivery,
  };
}

const headClass =
  'px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase';

export function OrdersClient() {
  const t = useTranslations('adminOrders');
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();

  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  /** Shown after a 409 ORDER_CHANGED made us reload the row. */
  const [rowNotice, setRowNotice] = useState<string | null>(null);
  /** The order whose cancel dialog is open, if any. A reason is required. */
  const [cancelling, setCancelling] = useState<AdminOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  /** The order whose "adjust total" dialog is open, if any (issue #51). */
  const [adjusting, setAdjusting] = useState<AdminOrder | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  /** The order whose COD payment dialog is open, if any (gap G18). */
  const [paying, setPaying] = useState<AdminOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
          setLoadError(describeError(error, t('loadFailed'), translateApiError));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function replaceRow(updated: AdminOrder) {
    setOrders(
      (current) =>
        current?.map((o) => (o.id === updated.id ? mergeRow(o, updated) : o)) ?? current,
    );
  }

  /**
   * After a 409 ORDER_CHANGED: fetch the current state and swap in just that
   * row (there is no admin detail endpoint), then say what happened.
   */
  async function reloadRow(id: string) {
    try {
      const rows = await apiAdminListOrders();
      const fresh = rows.find((o) => o.id === id);
      if (fresh) {
        setOrders((current) => current?.map((o) => (o.id === id ? fresh : o)) ?? current);
      }
      setRowNotice(t('orderChangedReloaded'));
    } catch (error) {
      setRowError(describeError(error, t('loadFailed'), translateApiError));
    }
  }

  function choose(order: AdminOrder, status: OrderStatus) {
    // Cancelling is terminal and needs a reason, so it goes through a dialog.
    if (status === 'CANCELLED') {
      setCancelling(order);
      setCancelReason('');
      setCancelError(null);
      return;
    }
    void move(order, status);
  }

  async function move(order: AdminOrder, status: OrderStatus) {
    setBusyId(order.id);
    setRowError(null);
    setRowNotice(null);
    try {
      replaceRow(await apiAdminSetOrderStatus(order.id, status));
    } catch (error) {
      if (isOrderChanged(error)) await reloadRow(order.id);
      else setRowError(describeError(error, t('updateFailed'), translateApiError));
    } finally {
      setBusyId(null);
    }
  }

  const cancelReasonValid = cancelReason.trim().length >= CANCEL_REASON_MIN;

  async function submitCancel() {
    if (!cancelling) return;
    if (!cancelReasonValid) {
      setCancelError(t('cancelReasonTooShort', { min: CANCEL_REASON_MIN }));
      return;
    }
    const order = cancelling;
    setCancelBusy(true);
    setCancelError(null);
    setRowError(null);
    setRowNotice(null);
    try {
      replaceRow(await apiAdminSetOrderStatus(order.id, 'CANCELLED', cancelReason));
      setCancelling(null);
    } catch (error) {
      if (isOrderChanged(error)) {
        setCancelling(null);
        await reloadRow(order.id);
      } else {
        setCancelError(describeError(error, t('updateFailed'), translateApiError));
      }
    } finally {
      setCancelBusy(false);
    }
  }

  function openAdjust(order: AdminOrder) {
    setAdjusting(order);
    setAdjustAmount(
      order.adjustedTotalGrosze != null ? groszeToZloteInput(order.adjustedTotalGrosze) : '',
    );
    setAdjustNote('');
    setAdjustError(null);
  }

  /** `clear` sends null, which puts the order back to owing totalGrosze. */
  async function submitAdjust(clear: boolean) {
    if (!adjusting) return;
    let adjustedTotalGrosze: number | null = null;
    if (!clear) {
      // String to integer grosze; never parseFloat * 100.
      adjustedTotalGrosze = zloteToGrosze(adjustAmount);
      if (adjustedTotalGrosze === null) {
        setAdjustError(t('paymentAmountInvalid'));
        return;
      }
    }
    const order = adjusting;
    setAdjustBusy(true);
    setAdjustError(null);
    setRowError(null);
    setRowNotice(null);
    try {
      const note = adjustNote.trim();
      replaceRow(
        await apiAdminAdjustOrderTotal(order.id, {
          adjustedTotalGrosze,
          ...(note ? { note } : {}),
        }),
      );
      setAdjusting(null);
    } catch (error) {
      if (isOrderChanged(error)) {
        setAdjusting(null);
        await reloadRow(order.id);
      } else {
        setAdjustError(describeError(error, t('adjustFailed'), translateApiError));
      }
    } finally {
      setAdjustBusy(false);
    }
  }

  function openPayment(order: AdminOrder) {
    setPaying(order);
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentError(null);
  }

  async function submitPayment() {
    if (!paying) return;
    const paidGrosze = zloteToGrosze(paymentAmount);
    if (paidGrosze === null) {
      setPaymentError(t('paymentAmountInvalid'));
      return;
    }
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const saved = await apiRecordDeliveryPayment(paying.id, {
        paidGrosze,
        paymentNote: paymentNote.trim() || undefined,
      });
      // The server decides whether this settled the order: a part payment
      // accumulates and leaves paidAt null.
      setOrders(
        (current) =>
          current?.map((o) =>
            o.id === paying.id
              ? { ...o, paidAt: saved.paidAt, paidGrosze: saved.paidGrosze, paymentNote: saved.paymentNote }
              : o,
          ) ?? current,
      );
      setPaying(null);
    } catch (error) {
      setPaymentError(describeError(error, t('paymentFailed'), translateApiError));
    } finally {
      setPaymentBusy(false);
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
      {rowNotice && (
        <Alert data-testid="order-notice">
          <AlertDescription>{rowNotice}</AlertDescription>
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
                <TableHead className={headClass}>{t('payment')}</TableHead>
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
                    <TableCell
                      className="max-w-48 px-3 py-2.5 text-right align-top whitespace-normal"
                      data-testid="order-total"
                    >
                      {order.adjustedTotalGrosze != null ? (
                        <>
                          <div className="text-xs text-muted-foreground line-through">
                            <span className="sr-only">{t('originalTotal')}: </span>
                            {formatGrosze(order.totalGrosze, locale)}
                          </div>
                          <div className="font-semibold" data-testid="adjusted-total">
                            <span className="sr-only">{t('adjustedTotal')}: </span>
                            {formatGrosze(order.adjustedTotalGrosze, locale)}
                          </div>
                        </>
                      ) : (
                        <div className="font-semibold">
                          {formatGrosze(order.totalGrosze, locale)}
                        </div>
                      )}
                      {order.totalAdjustment && (
                        <div
                          className="mt-1 text-xs text-muted-foreground"
                          data-testid="total-adjustment"
                        >
                          <div>
                            {t('adjustedAt', {
                              date: formatWarsawDate(order.totalAdjustment.adjustedAt, locale),
                            })}
                          </div>
                          {order.totalAdjustment.note && (
                            <div className="break-words">
                              {t('adjustedNote', { note: order.totalAdjustment.note })}
                            </div>
                          )}
                        </div>
                      )}
                      {canAdjustTotal(order) && (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto px-0"
                          onClick={() => openAdjust(order)}
                          data-testid="adjust-total"
                        >
                          {t('adjustTotal')}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 px-3 py-2.5 align-top whitespace-normal">
                      <Badge
                        variant="outline"
                        className="tracking-wider uppercase"
                        data-testid="order-status"
                      >
                        {t(`statuses.${order.status}`)}
                      </Badge>
                      {order.status === 'CANCELLED' && (order.cancelledAt || order.cancelReason) && (
                        <div
                          className="mt-1.5 text-xs text-muted-foreground"
                          data-testid="cancel-info"
                        >
                          {order.cancelledAt && (
                            <div>
                              {t('cancelledOn', {
                                date: formatWarsawDate(order.cancelledAt, locale),
                              })}
                            </div>
                          )}
                          {order.cancelReason && (
                            <div className="break-words">
                              {t('cancelledReason', { reason: order.cancelReason })}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 align-top">
                      {formatWarsawDate(order.createdAt, locale)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 align-top" data-testid="order-payment">
                      {order.paidAt ? (
                        <Badge
                          variant="outline"
                          className="border-primary tracking-wider text-primary uppercase"
                          data-testid="paid-badge"
                        >
                          {t('paid')}
                        </Badge>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          {(order.paidGrosze ?? 0) > 0 && (
                            <span className="text-xs text-muted-foreground" data-testid="part-paid">
                              {t('partPaid', {
                                paid: formatGrosze(order.paidGrosze ?? 0, locale),
                                due: formatGrosze(order.adjustedTotalGrosze ?? order.totalGrosze, locale),
                              })}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openPayment(order)}
                            data-testid="record-payment"
                          >
                            {t('recordPayment')}
                          </Button>
                        </div>
                      )}
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

      <Dialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open && !cancelBusy) setCancelling(null);
        }}
      >
        <DialogContent data-testid="cancel-dialog">
          <DialogHeader>
            <DialogTitle>{t('cancelTitle')}</DialogTitle>
            <DialogDescription>{t('cancelConfirm')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-reason">{t('cancelReason')}</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              maxLength={CANCEL_REASON_MAX}
              aria-describedby="cancel-reason-hint"
              aria-invalid={cancelError ? true : undefined}
              required
              data-testid="cancel-reason-input"
            />
            <div
              id="cancel-reason-hint"
              className="flex justify-between gap-2 text-xs text-muted-foreground"
            >
              <span>
                {t('cancelReasonHint', { min: CANCEL_REASON_MIN, max: CANCEL_REASON_MAX })}
              </span>
              <span className="tabular-nums" data-testid="cancel-reason-count">
                {t('charCount', { count: cancelReason.length, max: CANCEL_REASON_MAX })}
              </span>
            </div>
          </div>
          {cancelError && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-line">{cancelError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelling(null)}
              disabled={cancelBusy}
            >
              {t('cancelBack')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void submitCancel()}
              disabled={cancelBusy || !cancelReasonValid}
              data-testid="confirm-cancel"
            >
              {t('cancelYes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adjusting !== null}
        onOpenChange={(open) => {
          if (!open && !adjustBusy) setAdjusting(null);
        }}
      >
        <DialogContent data-testid="adjust-dialog">
          <DialogHeader>
            <DialogTitle>{t('adjustTitle')}</DialogTitle>
            <DialogDescription>
              {adjusting
                ? t('adjustDescription', { original: formatGrosze(adjusting.totalGrosze, locale) })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="adjust-amount">{t('adjustAmount')}</Label>
            <Input
              id="adjust-amount"
              type="text"
              inputMode="decimal"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder={adjusting ? groszeToZloteInput(adjusting.totalGrosze) : ''}
              data-testid="adjust-amount-input"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adjust-note">{t('adjustNote')}</Label>
            <Textarea
              id="adjust-note"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              rows={2}
              maxLength={ADJUST_NOTE_MAX}
              data-testid="adjust-note-input"
            />
            <span className="text-right text-xs text-muted-foreground tabular-nums">
              {t('charCount', { count: adjustNote.length, max: ADJUST_NOTE_MAX })}
            </span>
          </div>
          {adjustError && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-line">{adjustError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="flex-wrap">
            {adjusting?.adjustedTotalGrosze != null && (
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto"
                onClick={() => void submitAdjust(true)}
                disabled={adjustBusy}
                data-testid="clear-adjustment"
              >
                {t('adjustClear')}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdjusting(null)}
              disabled={adjustBusy}
            >
              {t('cancelBack')}
            </Button>
            <Button
              type="button"
              onClick={() => void submitAdjust(false)}
              disabled={adjustBusy}
              data-testid="submit-adjust"
            >
              {t('adjustSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
      >
        <DialogContent data-testid="payment-dialog">
          <DialogHeader>
            <DialogTitle>{t('recordPayment')}</DialogTitle>
            <DialogDescription>
              {paying ? t('paymentDescription', { name: paying.user?.fullName ?? paying.user?.email ?? '' }) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="payment-amount">{t('paymentAmount')}</Label>
            <Input
              id="payment-amount"
              type="text"
              inputMode="decimal"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder={
                paying
                  ? formatGrosze(paying.adjustedTotalGrosze ?? paying.totalGrosze, locale)
                  : ''
              }
              data-testid="payment-amount-input"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="payment-note">{t('paymentNote')}</Label>
            <Textarea
              id="payment-note"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              rows={2}
              maxLength={500}
              data-testid="payment-note-input"
            />
          </div>
          {paymentError && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-line">{paymentError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaying(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void submitPayment()}
              disabled={paymentBusy}
              data-testid="submit-payment"
            >
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
