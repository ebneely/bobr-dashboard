'use client';

import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAddClosedDay, useClosedDays, useDeleteClosedDay } from '@/lib/hooks/use-settings';
import { useDescribeError } from '@/lib/settings/use-settings-text';

const REASON_MAX = 200;

/** Today as a Warsaw calendar day, YYYY-MM-DD — never the browser's zone. */
export function warsawToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** A DATE (no time) → "czwartek, 24 grudnia 2026". Read as UTC so it never shifts a day. */
function formatDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Days nothing is delivered (public holidays, a kitchen break). The reason is
 * for staff only — customers just see the day as unavailable.
 */
export function ClosedDaysManager() {
  const t = useTranslations('settings.closedDays');
  const locale = useLocale();
  const describe = useDescribeError();
  const list = useClosedDays();
  const add = useAddClosedDay();
  const remove = useDeleteClosedDay();

  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const today = warsawToday();

  async function submit() {
    setFormError(null);
    const trimmed = reason.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError(t('dateRequired'));
      return;
    }
    if (trimmed === '') {
      setFormError(t('reasonRequired'));
      return;
    }
    try {
      await add.mutateAsync({ date, reason: trimmed });
      toast.success(t('added', { day: formatDay(date, locale) }));
      setDate('');
      setReason('');
    } catch (error) {
      setFormError(describe(error, t('addFailed')));
    }
  }

  async function del(day: string) {
    setDeleting(day);
    try {
      await remove.mutateAsync(day);
      toast.success(t('removed', { day: formatDay(day, locale) }));
    } catch (error) {
      toast.error(describe(error, t('removeFailed')));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="closed-day-date">{t('date')}</Label>
              <Input
                id="closed-day-date"
                type="date"
                min={today}
                value={date}
                className="w-44"
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor="closed-day-reason">{t('reason')}</Label>
              <Input
                id="closed-day-reason"
                value={reason}
                maxLength={REASON_MAX}
                placeholder={t('reasonPlaceholder')}
                onChange={(event) => setReason(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submit();
                }}
              />
            </div>
            <Button type="button" onClick={() => void submit()} disabled={add.isPending}>
              {add.isPending ? t('adding') : t('add')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('reasonHint')}</p>
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-line">{formError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        {list.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : list.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{describe(list.error, t('loadFailed'))}</AlertDescription>
          </Alert>
        ) : list.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('reason')}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t('actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((day) => (
                  <TableRow key={day.date} data-testid="closed-day-row">
                    <TableCell className="whitespace-nowrap first-letter:uppercase">
                      <time dateTime={day.date}>{formatDay(day.date, locale)}</time>
                    </TableCell>
                    <TableCell>{day.reason}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={deleting === day.date}
                        aria-label={t('remove', { day: formatDay(day.date, locale) })}
                        onClick={() => void del(day.date)}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
