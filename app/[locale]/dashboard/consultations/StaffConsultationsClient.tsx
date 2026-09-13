'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MoreHorizontalIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  CONSULTATION_STATUS_MOVES,
  apiAdminListConsultations,
  apiAdminSetConsultationPaid,
  apiAdminSetConsultationStatus,
  formatWarsawDateTime,
  type AdminConsultation,
  type Consultation,
} from '@/lib/api/consultations';

import { ConfirmConsultationDialog } from './ConfirmConsultationDialog';
import { ConsultationStatusBadge } from './StatusBadge';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

type StatusMove = { row: AdminConsultation; status: 'COMPLETED' | 'CANCELLED' };

/**
 * Every booking, for ADMIN and DOCTOR. `canMarkPaid` is true for ADMIN only —
 * a UI courtesy; the backend refuses the paid PATCH from a DOCTOR regardless.
 */
export function StaffConsultationsClient({ canMarkPaid }: { canMarkPaid: boolean }) {
  const t = useTranslations('consultationsPage');
  const locale = useLocale();
  const [paidBusyId, setPaidBusyId] = useState<string | null>(null);
  const [paidError, setPaidError] = useState<string | null>(null);

  const [rows, setRows] = useState<AdminConsultation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AdminConsultation | null>(null);
  const [move, setMove] = useState<StatusMove | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiAdminListConsultations()
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

  /** Merge a PATCH response into the row; the response carries no customer. */
  function applyUpdate(updated: Consultation) {
    setRows((current) =>
      (current ?? []).map((row) =>
        row.id === updated.id ? { ...row, ...updated, customer: row.customer } : row,
      ),
    );
  }

  async function runMove() {
    if (!move) return;
    setMoveBusy(true);
    setMoveError(null);
    try {
      applyUpdate(await apiAdminSetConsultationStatus(move.row.id, move.status));
      setMove(null);
    } catch (error) {
      setMoveError(describeError(error, t('updateFailed')));
    } finally {
      setMoveBusy(false);
    }
  }

  async function setPaid(row: AdminConsultation, paid: boolean) {
    setPaidBusyId(row.id);
    setPaidError(null);
    try {
      applyUpdate(await apiAdminSetConsultationPaid(row.id, paid));
    } catch (error) {
      setPaidError(describeError(error, t('paidFailed')));
    } finally {
      setPaidBusyId(null);
    }
  }

  if (rows === null) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
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
        <CardContent className="text-muted-foreground">{t('none')}</CardContent>
      </Card>
    );
  }

  return (
    <>
      {paidError ? (
        <Alert variant="destructive" data-testid="paid-error">
          <AlertDescription className="whitespace-pre-line">{paidError}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t('customer')}</TableHead>
                <TableHead>{t('context')}</TableHead>
                <TableHead>{t('preferred')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('payment')}</TableHead>
                <TableHead>{t('scheduled')}</TableHead>
                <TableHead>{t('meet')}</TableHead>
                <TableHead className="pr-4 text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const moves = CONSULTATION_STATUS_MOVES[row.status];
                const canConfirm = row.status === 'REQUESTED';
                const statusActions = canConfirm || moves.length > 0;
                return (
                  <TableRow key={row.id} data-consultation-id={row.id}>
                    <TableCell className="pl-4">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {row.customer.name || row.customer.email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          <span className="sr-only">{t('email')}: </span>
                          {row.customer.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{t(`contexts.${row.context}`)}</TableCell>
                    <TableCell>{formatWarsawDateTime(row.preferredAt, locale)}</TableCell>
                    <TableCell>
                      <ConsultationStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell data-testid="payment">
                      {row.paidAt ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <Badge>{t('paid')}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatWarsawDateTime(row.paidAt, locale)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-0.5">
                          <Badge variant="outline">{t('unpaid')}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">
                            <span className="sr-only">{t('reference')}: </span>
                            {row.paymentReference}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell data-testid="scheduled-at">
                      {row.scheduledAt ? formatWarsawDateTime(row.scheduledAt, locale) : '—'}
                    </TableCell>
                    <TableCell>
                      {row.meetUrl ? (
                        <Button asChild variant="link" size="sm" className="px-0">
                          <a href={row.meetUrl} target="_blank" rel="noopener noreferrer">
                            {row.meetUrl.replace('https://meet.google.com/', '')}
                          </a>
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {statusActions || canMarkPaid ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={t('openActions')}
                              disabled={paidBusyId === row.id}
                              data-testid="consultation-actions"
                            >
                              {t('actions')}
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canConfirm ? (
                              <DropdownMenuItem onSelect={() => setConfirming(row)}>
                                {t('confirm')}
                              </DropdownMenuItem>
                            ) : null}
                            {moves.includes('COMPLETED') ? (
                              <DropdownMenuItem
                                onSelect={() => {
                                  setMoveError(null);
                                  setMove({ row, status: 'COMPLETED' });
                                }}
                              >
                                {t('complete')}
                              </DropdownMenuItem>
                            ) : null}
                            {moves.includes('CANCELLED') ? (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => {
                                  setMoveError(null);
                                  setMove({ row, status: 'CANCELLED' });
                                }}
                              >
                                {t('cancel')}
                              </DropdownMenuItem>
                            ) : null}
                            {canMarkPaid ? (
                              <>
                                {statusActions ? <DropdownMenuSeparator /> : null}
                                <DropdownMenuItem
                                  data-testid={row.paidAt ? 'unmark-paid' : 'mark-paid'}
                                  onSelect={() => void setPaid(row, row.paidAt === null)}
                                >
                                  {row.paidAt ? t('unmarkPaid') : t('markPaid')}
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmConsultationDialog
        consultation={confirming}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        onConfirmed={(updated) => {
          applyUpdate(updated);
          setConfirming(null);
        }}
      />

      <AlertDialog
        open={move !== null}
        onOpenChange={(open) => {
          if (!open && !moveBusy) setMove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {move?.status === 'COMPLETED' ? t('completeTitle') : t('cancelTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {move?.status === 'COMPLETED' ? t('completeBody') : t('cancelBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {moveError ? (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-line">{moveError}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={moveBusy}>{t('back')}</AlertDialogCancel>
            {/* A plain Button, not AlertDialogAction: Action closes the dialog on
                click, before the request has had a chance to fail. */}
            <Button
              variant={move?.status === 'CANCELLED' ? 'destructive' : 'default'}
              disabled={moveBusy}
              onClick={() => void runMove()}
            >
              {move?.status === 'COMPLETED' ? t('complete') : t('cancel')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
