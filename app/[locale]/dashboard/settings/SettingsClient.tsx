'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

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
  apiAdminSetPaymentSettings,
  apiGetPaymentSettings,
  formatBlikPhone,
  type PaymentSettings,
} from '@/lib/api/settings';
import { Link } from '@/lib/i18n/navigation';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

type Feedback =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | null;

/** An empty field means "remove it" — the API takes null, not "". */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The BLIK details customers pay consultations to.
 *
 * One-time shipping used to be edited here as a single flat price; it now
 * comes from delivery zones. The flat value stays in the backend only as the
 * fallback for the old storefront, so it is deliberately not shown.
 */
export function SettingsClient() {
  const t = useTranslations('settingsPage');

  const [current, setCurrent] = useState<PaymentSettings | null>(null);
  const [phone, setPhone] = useState('');
  const [recipient, setRecipient] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function apply(settings: PaymentSettings) {
    setCurrent(settings);
    setPhone(settings.blikPhone ? formatBlikPhone(settings.blikPhone) : '');
    setRecipient(settings.blikRecipientName ?? '');
  }

  useEffect(() => {
    let alive = true;
    apiGetPaymentSettings()
      .then((settings) => {
        if (!alive) return;
        apply(settings);
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
    setSaving(true);
    try {
      // Normalising the phone is the backend's job: it accepts spaces, dashes
      // and +48 / 0048, and answers 422 with the field when it cannot.
      apply(
        await apiAdminSetPaymentSettings({
          blikPhone: orNull(phone),
          blikRecipientName: orNull(recipient),
        }),
      );
      setFeedback({ kind: 'success', message: t('saved') });
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('blikTitle')}</CardTitle>
          <CardDescription>{t('blikDescription')}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* The one thing that makes customers' payments fail: a BLIK phone
              transfer only reaches a number registered for receiving in the
              owner's bank app. Payments are not confirmed automatically. */}
          <Alert data-testid="blik-requirement">
            <AlertTitle>{t('blikRequirementTitle')}</AlertTitle>
            <AlertDescription>{t('blikRequirement')}</AlertDescription>
          </Alert>

          {current === null ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-9 w-full max-w-xs" />
              <Skeleton className="h-9 w-full max-w-sm" />
            </div>
          ) : (
            <>
              {current.blikPhone ? (
                <div className="flex flex-col gap-0.5 text-sm" data-testid="blik-current">
                  <p>
                    {t('current', { phone: formatBlikPhone(current.blikPhone) })}
                  </p>
                  {current.blikRecipientName ? (
                    <p className="text-muted-foreground">
                      {t('currentRecipient', { name: current.blikRecipientName })}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="blik-current">
                  {t('notSet')}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="blik-phone">{t('phoneLabel')}</Label>
                <Input
                  id="blik-phone"
                  name="blikPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="+48 600 123 456"
                  className="max-w-xs"
                  value={phone}
                  aria-describedby="blik-phone-hint"
                  onChange={(event) => setPhone(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void save();
                  }}
                />
                <p id="blik-phone-hint" className="text-xs text-muted-foreground">
                  {t('phoneHint')}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="blik-recipient">{t('recipientLabel')}</Label>
                <Input
                  id="blik-recipient"
                  name="blikRecipientName"
                  autoComplete="off"
                  className="max-w-sm"
                  value={recipient}
                  aria-describedby="blik-recipient-hint"
                  onChange={(event) => setRecipient(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void save();
                  }}
                />
                <p id="blik-recipient-hint" className="text-xs text-muted-foreground">
                  {t('recipientHint')}
                </p>
              </div>

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

      <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>{t('zonesNote')}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/zones">{t('zonesLink')}</Link>
        </Button>
      </div>
    </>
  );
}
