'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError, formatApiError } from '@/lib/api/client';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import {
  CONFIRM_TIME_SLOTS,
  apiAdminConfirmConsultation,
  formatWarsawDateTime,
  matchesMeetUrlPattern,
  warsawWallClockToIso,
  type AdminConsultation,
  type StaffConsultation,
} from '@/lib/api/consultations';

/** Today as YYYY-MM-DD in Warsaw — the earliest day the date field offers. */
function warsawToday(): string {
  return format(new TZDate(Date.now(), 'Europe/Warsaw'), 'yyyy-MM-dd');
}

/**
 * Confirms a REQUESTED consultation with a Warsaw wall-clock time and a Meet
 * link. Mounted once; `consultation` non-null means open. The form state lives
 * in an inner component keyed by id, so each opening starts clean.
 */
export function ConfirmConsultationDialog({
  consultation,
  onOpenChange,
  onConfirmed,
}: {
  consultation: AdminConsultation | null;
  onOpenChange: (open: boolean) => void;
  onConfirmed: (updated: StaffConsultation) => void;
}) {
  return (
    <Dialog open={consultation !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {consultation ? (
          <ConfirmForm
            key={consultation.id}
            consultation={consultation}
            onCancel={() => onOpenChange(false)}
            onConfirmed={onConfirmed}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmForm({
  consultation,
  onCancel,
  onConfirmed,
}: {
  consultation: AdminConsultation;
  onCancel: () => void;
  onConfirmed: (updated: StaffConsultation) => void;
}) {
  const t = useTranslations('consultationsPage');
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [meetUrl, setMeetUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [meetInvalid, setMeetInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setMeetInvalid(false);

    const scheduledAt = warsawWallClockToIso(date, time);
    if (!scheduledAt) {
      setError(t('dateTimeRequired'));
      return;
    }
    // The backend's own pattern, sent on the row; it validates again anyway.
    if (!matchesMeetUrlPattern(meetUrl, consultation.meetUrlPattern)) {
      setMeetInvalid(true);
      setError(t('meetUrlInvalid'));
      return;
    }

    setBusy(true);
    try {
      onConfirmed(
        await apiAdminConfirmConsultation(consultation.id, {
          scheduledAt,
          meetUrl: meetUrl.trim(),
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? formatApiError(caught.body, translateApiError) || t('confirmFailed')
          : t('confirmFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('confirmTitle')}</DialogTitle>
        <DialogDescription>
          {consultation.customer.name || consultation.customer.email} ·{' '}
          {t(`contexts.${consultation.context}`)} · {t('preferred')}:{' '}
          {formatWarsawDateTime(consultation.preferredAt, locale)}
        </DialogDescription>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">{t('confirmDescription')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-date">{t('date')}</Label>
          <Input
            id="confirm-date"
            name="date"
            type="date"
            min={warsawToday()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-time">{t('time')}</Label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger id="confirm-time" className="w-full">
              <SelectValue placeholder={t('pickTime')} />
            </SelectTrigger>
            <SelectContent>
              {CONFIRM_TIME_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {slot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-meet">{t('meetUrl')}</Label>
        <Input
          id="confirm-meet"
          name="meetUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder={t('meetUrlPlaceholder')}
          value={meetUrl}
          aria-invalid={meetInvalid || undefined}
          aria-describedby="confirm-meet-hint"
          onChange={(event) => {
            setMeetUrl(event.target.value);
            setMeetInvalid(false);
          }}
        />
        <p id="confirm-meet-hint" className="text-xs text-muted-foreground">
          {t('meetUrlHint')}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" data-testid="confirm-error">
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          {t('back')}
        </Button>
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? t('confirming') : t('confirm')}
        </Button>
      </DialogFooter>
    </>
  );
}
