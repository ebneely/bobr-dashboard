'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, apiAssetUrl, formatApiError, type ApiErrorTranslate } from '@/lib/api/client';
import {
  apiAdminGetCustomer,
  type AdminCustomerDetail,
} from '@/lib/api/customers';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import { formatGrosze, formatWarsawDate } from '@/lib/api/orders';

function describeError(
  error: unknown,
  fallback: string,
  translate: ApiErrorTranslate,
): string {
  if (error instanceof ApiError) return formatApiError(error.body, translate) || fallback;
  return fallback;
}

const MUTED_LABEL = 'text-xs tracking-wider text-muted-foreground uppercase';

export function CustomerDetailClient({ id }: { id: string }) {
  const t = useTranslations('customerDetail');
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();

  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiAdminGetCustomer(id)
      .then((data) => {
        if (alive) {
          setDetail(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (alive) setError(describeError(err, t('loadFailed'), translateApiError));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col gap-3" aria-label={t('loading')}>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const { profile, intake, orders, notes, consultations, weightEntries } = detail;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{profile.name || profile.email}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <span className={MUTED_LABEL}>{t('email')}</span>
            <p>{profile.email}</p>
          </div>
          <div>
            <span className={MUTED_LABEL}>{t('phone')}</span>
            <p>{profile.phone ?? '—'}</p>
          </div>
          <div>
            <span className={MUTED_LABEL}>{t('locale')}</span>
            <p>{profile.locale}</p>
          </div>
          <div>
            <span className={MUTED_LABEL}>{t('joined')}</span>
            <p>{formatWarsawDate(profile.createdAt, locale)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('intake.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!intake ? (
            <p className="text-muted-foreground">{t('intake.none')}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <span className={MUTED_LABEL}>{t('intake.weight')}</span>
                  <p>{intake.weightKg != null ? `${intake.weightKg} kg` : '—'}</p>
                </div>
                <div>
                  <span className={MUTED_LABEL}>{t('intake.height')}</span>
                  <p>{intake.heightCm != null ? `${intake.heightCm} cm` : '—'}</p>
                </div>
                <div>
                  <span className={MUTED_LABEL}>{t('intake.bodyComposition')}</span>
                  <p>{intake.bodyComposition ?? '—'}</p>
                </div>
              </div>

              <div>
                <span className={MUTED_LABEL}>{t('intake.activity')}</span>
                <p>
                  {intake.activityTypes.length > 0
                    ? intake.activityTypes.join(', ')
                    : '—'}
                  {intake.activityOther ? ` (${intake.activityOther})` : ''}
                </p>
              </div>

              <div>
                <span className={MUTED_LABEL}>{t('intake.allergens')}</span>
                {intake.allergens.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {intake.allergens.map((a) => (
                      <Badge key={a} variant="outline">
                        {a}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('intake.noAllergens')}</p>
                )}
              </div>

              {intake.dietaryNotes && (
                <div>
                  <span className={MUTED_LABEL}>{t('intake.dietaryNotes')}</span>
                  <p className="wrap-anywhere">{intake.dietaryNotes}</p>
                </div>
              )}

              {Object.keys(intake.photos).length > 0 && (
                <div>
                  <span className={MUTED_LABEL}>{t('intake.photos')}</span>
                  <div className="mt-1.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {Object.entries(intake.photos).map(([position, url]) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={position}
                        src={apiAssetUrl(url)}
                        alt={position}
                        className="aspect-3/4 w-full rounded-md object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {intake.completedAt
                  ? t('intake.completedAt', {
                      date: formatWarsawDate(intake.completedAt, locale),
                    })
                  : t('intake.incomplete')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('orders.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-muted-foreground">{t('orders.none')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                  <Badge variant="outline" className="uppercase">
                    {o.status}
                  </Badge>
                  <span>{locale === 'pl' ? o.meal?.namePl : o.meal?.nameEn ?? '—'}</span>
                  <span className="font-semibold">
                    {formatGrosze(o.adjustedTotalGrosze ?? o.totalGrosze, locale)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatWarsawDate(o.createdAt, locale)}
                  </span>
                  {o.paidAt && (
                    <Badge variant="outline" className="border-primary text-primary">
                      {t('orders.paid')}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('notes.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-muted-foreground">{t('notes.none')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notes.map((n) => (
                <li key={n.id} className="border-b pb-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="uppercase">
                      {n.kind}
                    </Badge>
                    <span className="text-muted-foreground">
                      {formatWarsawDate(n.createdAt, locale)}
                    </span>
                  </div>
                  <p className="mt-1 wrap-anywhere">{n.body}</p>
                  {n.adminReply && <p className="mt-1 wrap-anywhere text-muted-foreground">{n.adminReply}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('consultations.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {consultations.length === 0 ? (
            <p className="text-muted-foreground">{t('consultations.none')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {consultations.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                  <Badge variant="outline" className="uppercase">
                    {c.status}
                  </Badge>
                  <span>{c.scheduledAt ? formatWarsawDate(c.scheduledAt, locale) : '—'}</span>
                  {c.paidAt && (
                    <Badge variant="outline" className="border-primary text-primary">
                      {t('orders.paid')}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('weight.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {weightEntries.length === 0 ? (
            <p className="text-muted-foreground">{t('weight.none')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {weightEntries.map((w) => (
                <li key={w.id} className="flex gap-3">
                  <span className="text-muted-foreground">{w.measuredOn}</span>
                  <span className="font-semibold">{w.weightKg} kg</span>
                  {w.note && <span className="text-muted-foreground">{w.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
