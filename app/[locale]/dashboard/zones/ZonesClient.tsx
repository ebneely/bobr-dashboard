'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MoreHorizontalIcon, PlusIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import {
  apiAdminListZones,
  apiAdminUpdateZone,
  type DeliveryZone,
} from '@/lib/api/delivery-zones';
import { formatGrosze } from '@/lib/api/orders';

import { ZoneDialog, type ZoneDialogState } from './ZoneDialog';

function describeError(
  error: unknown,
  fallback: string,
  translate: ApiErrorTranslate,
): string {
  if (error instanceof ApiError) return formatApiError(error.body, translate) || fallback;
  return fallback;
}

export function ZonesClient() {
  const t = useTranslations('zonesPage');
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();

  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ZoneDialogState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiAdminListZones()
      .then((list) => {
        if (alive) setZones(list);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setZones([]);
        setLoadError(describeError(error, t('loadFailed'), translateApiError));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function upsert(saved: DeliveryZone) {
    setZones((current) => {
      const list = current ?? [];
      return list.some((zone) => zone.id === saved.id)
        ? list.map((zone) => (zone.id === saved.id ? saved : zone))
        : [...list, saved];
    });
  }

  /**
   * Activating can clash with another active zone's prefix; the 409 is shown
   * above the table rather than swallowed.
   */
  async function toggle(zone: DeliveryZone) {
    setBusyId(zone.id);
    setRowError(null);
    try {
      upsert(await apiAdminUpdateZone(zone.id, { isActive: !zone.isActive }));
    } catch (error) {
      setRowError(describeError(error, t('toggleFailed'), translateApiError));
    } finally {
      setBusyId(null);
    }
  }

  if (zones === null) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">{t('matching')}</p>
        <Button onClick={() => setDialog({ mode: 'create' })} data-testid="zone-new">
          <PlusIcon />
          {t('new')}
        </Button>
      </div>

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('loadFailed')}</AlertTitle>
          <AlertDescription className="whitespace-pre-line">{loadError}</AlertDescription>
        </Alert>
      ) : null}
      {rowError ? (
        <Alert variant="destructive" data-testid="zone-row-error">
          <AlertDescription className="whitespace-pre-line">{rowError}</AlertDescription>
        </Alert>
      ) : null}

      {zones.length === 0 && !loadError ? (
        <Card>
          <CardContent className="text-muted-foreground">{t('none')}</CardContent>
        </Card>
      ) : zones.length > 0 ? (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table data-testid="zones-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t('name')}</TableHead>
                  <TableHead>{t('prefixes')}</TableHead>
                  <TableHead className="text-right">{t('shipping')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="pr-4 text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id} data-zone-id={zone.id} data-testid="zone-row">
                    <TableCell className="pl-4 font-medium">
                      {locale === 'pl' ? zone.namePl : zone.nameEn}
                    </TableCell>
                    <TableCell className="min-w-40 whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {zone.postalCodePrefixes.map((prefix) => (
                          <Badge key={prefix} variant="secondary" className="font-mono">
                            {prefix}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold" data-testid="zone-price">
                      {formatGrosze(zone.oneTimeShippingGrosze, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={zone.isActive ? 'default' : 'outline'}
                        data-testid="zone-status"
                      >
                        {zone.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={t('openActions')}
                            disabled={busyId === zone.id}
                            data-testid="zone-actions"
                          >
                            {t('actions')}
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDialog({ mode: 'edit', zone })}>
                            {t('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant={zone.isActive ? 'destructive' : 'default'}
                            onSelect={() => void toggle(zone)}
                          >
                            {zone.isActive ? t('deactivate') : t('activate')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <ZoneDialog
        state={dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        onSaved={(saved) => {
          upsert(saved);
          setDialog(null);
        }}
      />
    </div>
  );
}
