'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, formatApiError } from '@/lib/api/client';
import {
  formatGrosze,
  groszeToZloteInput,
  zloteToGrosze,
} from '@/lib/api/orders';
import { apiAdminSetShipping, apiGetShipping } from '@/lib/api/settings';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

/** "15.00" → "15,00" for Polish; the parser accepts either separator. */
function toInput(grosze: number, locale: string): string {
  const value = groszeToZloteInput(grosze);
  return locale === 'pl' ? value.replace('.', ',') : value;
}

type Feedback =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | null;

export function SettingsClient() {
  const t = useTranslations('settingsPage');
  const locale = useLocale();

  const [current, setCurrent] = useState<number | null>(null);
  const [value, setValue] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let alive = true;
    apiGetShipping()
      .then((settings) => {
        if (!alive) return;
        setCurrent(settings.oneTimeShippingGrosze);
        setValue(toInput(settings.oneTimeShippingGrosze, locale));
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (alive) setLoadError(describeError(error, t('loadFailed')));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setFeedback(null);
    // String parsing, never parseFloat * 100 — see zloteToGrosze.
    const grosze = zloteToGrosze(value);
    if (grosze === null) {
      setFeedback({ kind: 'error', message: t('invalid') });
      return;
    }

    setSaving(true);
    try {
      const saved = await apiAdminSetShipping(grosze);
      setCurrent(saved.oneTimeShippingGrosze);
      setValue(toInput(saved.oneTimeShippingGrosze, locale));
      setFeedback({
        kind: 'success',
        message: t('saved', {
          amount: formatGrosze(saved.oneTimeShippingGrosze, locale),
        }),
      });
    } catch (error) {
      setFeedback({ kind: 'error', message: describeError(error, t('saveFailed')) });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('loadFailed')}</AlertTitle>
        <AlertDescription className="whitespace-pre-line">{loadError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('shippingTitle')}</CardTitle>
        <CardDescription>{t('shippingDescription')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {current === null ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full max-w-xs" />
          </div>
        ) : (
          <>
            <p className="text-sm">
              {t('current', { amount: formatGrosze(current, locale) })}
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="one-time-shipping">{t('amountLabel')}</Label>
              <Input
                id="one-time-shipping"
                name="oneTimeShipping"
                inputMode="decimal"
                autoComplete="off"
                className="max-w-xs"
                value={value}
                aria-describedby="one-time-shipping-hint"
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void save();
                }}
              />
              <p id="one-time-shipping-hint" className="text-xs text-muted-foreground">
                {t('amountHint')}
              </p>
            </div>

            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              <li>{t('calendarFree')}</li>
              <li>{t('placedKeep')}</li>
            </ul>

            {feedback ? (
              <Alert
                variant={feedback.kind === 'error' ? 'destructive' : 'default'}
                data-testid={`settings-${feedback.kind}`}
              >
                <AlertTitle>
                  {feedback.kind === 'error' ? t('errorTitle') : t('savedTitle')}
                </AlertTitle>
                <AlertDescription className="whitespace-pre-line">
                  {feedback.message}
                </AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
      </CardContent>

      <CardFooter>
        <Button onClick={() => void save()} disabled={saving || current === null}>
          {saving ? t('saving') : t('save')}
        </Button>
      </CardFooter>
    </Card>
  );
}
