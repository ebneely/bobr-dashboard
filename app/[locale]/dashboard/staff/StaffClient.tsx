'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MoreHorizontalIcon, PlusIcon } from 'lucide-react';

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
import { ApiError, formatApiError, type ApiErrorTranslate } from '@/lib/api/client';
import { formatWarsawDateTime } from '@/lib/api/consultations';
import { isStaffRowActionable, type StaffUser } from '@/lib/api/staff';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import { useResetStaffPassword, useSetStaffActive, useStaffList } from '@/lib/hooks/use-staff';

import { AddStaffDialog } from './AddStaffDialog';
import { TemporaryPasswordDialog, type TemporaryPasswordState } from './TemporaryPasswordDialog';

function describeError(error: unknown, fallback: string, translate: ApiErrorTranslate): string {
  if (error instanceof ApiError) return formatApiError(error.body, translate) || fallback;
  return fallback;
}

type Confirm = { kind: 'reset' | 'deactivate' | 'reactivate'; user: StaffUser } | null;

export function StaffClient({ selfId }: { selfId: string }) {
  const t = useTranslations('staffPage');
  const tRole = useTranslations('shell.role');
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();

  const list = useStaffList();
  const reset = useResetStaffPassword();
  const setActive = useSetStaffActive();

  const [adding, setAdding] = useState(false);
  // Bumped on every opening, so the add form starts empty each time without
  // being unmounted while the dialog animates closed.
  const [addKey, setAddKey] = useState(0);
  const [confirm, setConfirm] = useState<Confirm>(null);
  // The last confirmation stays rendered while the dialog animates closed;
  // without it the closing dialog flashes empty.
  const [shownConfirm, setShownConfirm] = useState<Confirm>(null);
  if (confirm !== null && confirm !== shownConfirm) setShownConfirm(confirm);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [secret, setSecret] = useState<TemporaryPasswordState>(null);

  const busy = reset.isPending || setActive.isPending;

  async function runConfirm() {
    if (!confirm) return;
    setConfirmError(null);
    const { kind, user } = confirm;
    try {
      if (kind === 'reset') {
        const { temporaryPassword } = await reset.mutateAsync(user.id);
        setConfirm(null);
        setSecret({ kind: 'reset', email: user.email, password: temporaryPassword });
      } else {
        await setActive.mutateAsync({ id: user.id, isActive: kind === 'reactivate' });
        setConfirm(null);
      }
    } catch (error) {
      setConfirmError(describeError(error, t('actionFailed'), translateApiError));
    }
  }

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const users = list.data ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">{t('explain')}</p>
        <Button
          onClick={() => {
            setAddKey((key) => key + 1);
            setAdding(true);
          }}
          data-testid="staff-add"
        >
          <PlusIcon />
          {t('add')}
        </Button>
      </div>

      {list.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('loadFailed')}</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {describeError(list.error, t('loadFailed'), translateApiError)}
          </AlertDescription>
        </Alert>
      ) : null}

      {users.length > 0 ? (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table data-testid="staff-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t('name')}</TableHead>
                  <TableHead>{t('email')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('lastSignIn')}</TableHead>
                  <TableHead className="pr-4 text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const actionable = isStaffRowActionable(user, selfId);
                  return (
                    <TableRow key={user.id} data-testid="staff-row" data-email={user.email}>
                      <TableCell className="pl-4 font-medium">
                        {user.name || '—'}
                        {user.id === selfId ? (
                          <span className="ml-2 text-xs text-muted-foreground">{t('you')}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
                          {tRole(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isActive ? 'secondary' : 'outline'}
                          data-testid="staff-status"
                        >
                          {user.isActive ? t('active') : t('inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.lastSignInAt
                          ? formatWarsawDateTime(user.lastSignInAt, locale)
                          : t('never')}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {actionable ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                aria-label={t('openActions', { email: user.email })}
                                disabled={busy}
                                data-testid="staff-actions"
                              >
                                {t('actions')}
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setConfirmError(null);
                                  setConfirm({ kind: 'reset', user });
                                }}
                              >
                                {t('resetPassword')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant={user.isActive ? 'destructive' : 'default'}
                                onSelect={() => {
                                  setConfirmError(null);
                                  setConfirm({
                                    kind: user.isActive ? 'deactivate' : 'reactivate',
                                    user,
                                  });
                                }}
                              >
                                {user.isActive ? t('deactivate') : t('reactivate')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <AddStaffDialog
        formKey={addKey}
        open={adding}
        onOpenChange={setAdding}
        onCreated={(email, password) => {
          setAdding(false);
          setSecret({ kind: 'created', email, password });
        }}
      />

      <TemporaryPasswordDialog state={secret} onClose={() => setSecret(null)} />

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {shownConfirm ? t(`confirm.${shownConfirm.kind}.title`) : null}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {shownConfirm
                ? t(`confirm.${shownConfirm.kind}.body`, { email: shownConfirm.user.email })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmError ? (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-line">{confirmError}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('back')}</AlertDialogCancel>
            {/* A plain Button, not AlertDialogAction: Action closes the dialog
                before the request has had a chance to fail. */}
            <Button
              variant={shownConfirm?.kind === 'deactivate' ? 'destructive' : 'default'}
              onClick={() => void runConfirm()}
              disabled={busy}
              data-testid="staff-confirm"
            >
              {shownConfirm ? t(`confirm.${shownConfirm.kind}.action`) : null}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
