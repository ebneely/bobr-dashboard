'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { ApiError, formatApiError } from '@/lib/api/client';
import {
  apiGetMyIntake,
  storefrontIntakeUrl,
  type IntakeProfile,
} from '@/lib/api/intake';
import {
  apiListMyOrders,
  formatGrosze,
  formatWarsawDate,
  type Order,
} from '@/lib/api/orders';
import { Link } from '@/lib/i18n/navigation';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

/** `undefined` while loading; `null` for "no profile yet", which is not an error. */
type IntakeState = IntakeProfile | null | undefined;

export function MyDietClient() {
  const t = useTranslations('myDiet');

  const [intake, setIntake] = useState<IntakeState>(undefined);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Two independent loads: a failing orders call must not hide the profile,
  // and the other way round.
  useEffect(() => {
    let alive = true;
    apiGetMyIntake()
      .then((profile) => {
        if (alive) setIntake(profile);
      })
      .catch((error: unknown) => {
        if (alive) {
          setIntake(null);
          setIntakeError(describeError(error, t('intakeLoadFailed')));
        }
      });
    apiListMyOrders()
      .then((rows) => {
        if (alive) setOrders(rows);
      })
      .catch((error: unknown) => {
        if (alive) {
          setOrders([]);
          setOrdersError(describeError(error, t('ordersLoadFailed')));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
      <IntakeSection intake={intake} error={intakeError} />
      <OrdersSection orders={orders} error={ordersError} />
    </div>
  );
}

function IntakeSection({ intake, error }: { intake: IntakeState; error: string | null }) {
  const t = useTranslations('myDiet');
  const locale = useLocale();
  const numberFormat = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    maximumFractionDigits: 1,
  });

  const complete = Boolean(intake?.completedAt);

  return (
    <section style={card} data-testid="intake-section">
      <div style={sectionHead}>
        <h2 style={h2}>{t('intakeTitle')}</h2>
        {intake !== undefined && !error && (
          <span
            style={{
              ...badge,
              color: complete ? 'var(--bobr-accent-hover)' : 'var(--bobr-fg-muted)',
              borderColor: complete ? 'var(--bobr-accent)' : 'var(--bobr-border)',
            }}
            data-testid="intake-status"
          >
            {complete ? t('complete') : t('incomplete')}
          </span>
        )}
      </div>

      {intake === undefined ? (
        <p style={muted}>{t('loading')}</p>
      ) : error ? (
        <p role="alert" style={errorText}>
          {error}
        </p>
      ) : (
        <>
          {intake === null ? (
            <p style={muted}>{t('noProfile')}</p>
          ) : (
            <dl style={facts}>
              <Fact label={t('weight')}>
                {t('kg', { value: numberFormat.format(Number(intake.weightKg)) })}
              </Fact>
              <Fact label={t('height')}>
                {t('cm', { value: numberFormat.format(Number(intake.heightCm)) })}
              </Fact>
              <Fact label={t('bodyComposition')}>
                {intake.bodyComposition || t('notGiven')}
              </Fact>
              <Fact label={t('activities')}>
                {intake.activityTypes.length === 0
                  ? t('notGiven')
                  : intake.activityTypes
                      .map((a) =>
                        a === 'OTHER' && intake.activityOther
                          ? `${t('activity.OTHER')}: ${intake.activityOther}`
                          : t(`activity.${a}`),
                      )
                      .join(', ')}
              </Fact>
              {complete && intake.completedAt && (
                <Fact label={t('completedOn')}>
                  {formatWarsawDate(intake.completedAt, locale)}
                </Fact>
              )}
              {!complete && intake.missingPhotos.length > 0 && (
                <Fact label={t('missingPhotos')}>
                  {intake.missingPhotos.map((p) => t(`photo.${p}`)).join(', ')}
                </Fact>
              )}
            </dl>
          )}

          {!complete && (
            <div style={callout}>
              <p style={{ margin: 0 }}>{t('incompleteHint')}</p>
              {/* A plain <a>: the form is on the storefront, a different origin. */}
              <a href={storefrontIntakeUrl(locale)} style={primaryLink} data-testid="intake-link">
                {intake === null ? t('startIntake') : t('finishIntake')}
              </a>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={mutedLabel}>{label}</dt>
      <dd style={{ margin: '0.2rem 0 0', overflowWrap: 'anywhere' }}>{children}</dd>
    </div>
  );
}

function OrdersSection({ orders, error }: { orders: Order[] | null; error: string | null }) {
  const t = useTranslations('myDiet');
  const locale = useLocale();

  return (
    <section style={card} data-testid="orders-section">
      <div style={sectionHead}>
        <h2 style={h2}>{t('ordersTitle')}</h2>
        <Link href="/dashboard/calendar" style={secondaryLink} data-testid="calendar-link">
          {t('trackDays')}
        </Link>
      </div>

      {orders === null ? (
        <p style={muted}>{t('loading')}</p>
      ) : error ? (
        <p role="alert" style={errorText}>
          {error}
        </p>
      ) : orders.length === 0 ? (
        <p style={muted}>{t('noOrders')}</p>
      ) : (
        // Stacked cards rather than a table: a customer has a handful of
        // orders, and cards read on a phone without any sideways scroll.
        <ul style={list}>
          {orders.map((order) => (
            <li key={order.id} style={orderItem} data-testid="my-order">
              <div style={{ minWidth: 0 }}>
                <strong style={{ overflowWrap: 'anywhere' }}>
                  {order.meal
                    ? locale === 'pl'
                      ? order.meal.namePl
                      : order.meal.nameEn
                    : '—'}
                </strong>
                <div style={muted}>
                  {t('orderLine', {
                    mode: t(`modes.${order.mode}`),
                    days: order.days.length,
                    date: formatWarsawDate(order.createdAt, locale),
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={badge}>{t(`statuses.${order.status}`)}</span>
                <strong style={{ fontSize: 'var(--bobr-text-lg)' }}>
                  {formatGrosze(order.totalGrosze, locale)}
                </strong>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  minWidth: 0,
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius)',
  padding: '1rem',
};

const sectionHead: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
};

const h2: React.CSSProperties = {
  fontSize: 'var(--bobr-text-lg)',
  fontWeight: 600,
  margin: 0,
};

const facts: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))',
  gap: '1rem',
  margin: 0,
};

const callout: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.75rem',
  background: 'var(--bobr-surface-sunken)',
  borderRadius: 'var(--bobr-radius-sm)',
};

const list: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
};

const orderItem: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem 1rem',
  padding: '0.75rem',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
};

const muted: React.CSSProperties = { color: 'var(--bobr-fg-muted)' };

const mutedLabel: React.CSSProperties = {
  fontSize: 'var(--bobr-text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--bobr-fg-muted)',
};

const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.15rem 0.5rem',
  fontSize: 'var(--bobr-text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
};

const primaryLink: React.CSSProperties = {
  padding: '0.6rem 1.1rem',
  fontWeight: 600,
  color: 'var(--bobr-on-accent)',
  background: 'var(--bobr-accent)',
  borderRadius: 'var(--bobr-radius-sm)',
  textDecoration: 'none',
};

const secondaryLink: React.CSSProperties = {
  padding: '0.45rem 0.9rem',
  fontWeight: 600,
  color: 'var(--bobr-fg)',
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
  textDecoration: 'none',
};

const errorText: React.CSSProperties = {
  color: 'var(--bobr-danger)',
  whiteSpace: 'pre-line',
};
