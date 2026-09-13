'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { ApiError, formatApiError } from '@/lib/api/client';
import {
  apiAdminListOrders,
  apiAdminSetOrderStatus,
  formatGrosze,
  formatWarsawDate,
  nextStatuses,
  type AdminOrder,
  type OrderStatus,
} from '@/lib/api/orders';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

export function OrdersClient() {
  const t = useTranslations('adminOrders');
  const locale = useLocale();

  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

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
          setLoadError(describeError(error, t('loadFailed')));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function move(order: AdminOrder, status: OrderStatus) {
    // Cancelling is terminal — there is no way back from it — so ask first.
    if (status === 'CANCELLED' && !window.confirm(t('cancelConfirm'))) return;

    setBusyId(order.id);
    setRowError(null);
    try {
      const updated = await apiAdminSetOrderStatus(order.id, status);
      // The PATCH returns the bare row; keep the included user/meal/days.
      setOrders(
        (current) =>
          current?.map((o) =>
            o.id === order.id ? { ...o, status: updated.status } : o,
          ) ?? current,
      );
    } catch (error) {
      setRowError(describeError(error, t('updateFailed')));
    } finally {
      setBusyId(null);
    }
  }

  if (orders === null) {
    return <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('loading')}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
      {loadError && (
        <p role="alert" style={errorText}>
          {loadError}
        </p>
      )}
      {rowError && (
        <p role="alert" style={errorText}>
          {rowError}
        </p>
      )}

      {orders.length === 0 && !loadError ? (
        <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('none')}</p>
      ) : orders.length > 0 ? (
        // The table keeps its natural width; the wrapper scrolls instead of
        // the page, so a phone never gets a sideways-scrolling body.
        <div style={tableWrap}>
          <table style={tableStyle} data-testid="orders-table">
            <thead>
              <tr>
                <th style={th}>{t('customer')}</th>
                <th style={th}>{t('meal')}</th>
                <th style={th}>{t('mode')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('days')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('total')}</th>
                <th style={th}>{t('status')}</th>
                <th style={th}>{t('created')}</th>
                <th style={th}>{t('advance')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const next = nextStatuses(order.status);
                return (
                  <tr key={order.id} data-testid="order-row" data-order-id={order.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>
                        {order.user?.fullName ?? '—'}
                      </div>
                      <div style={muted}>{order.user?.email ?? ''}</div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'normal', minWidth: '9rem' }}>
                      {order.meal
                        ? locale === 'pl'
                          ? order.meal.namePl
                          : order.meal.nameEn
                        : '—'}
                    </td>
                    <td style={td}>{t(`modes.${order.mode}`)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{order.days.length}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>
                      {formatGrosze(order.totalGrosze, locale)}
                    </td>
                    <td style={td}>
                      <span style={badge} data-testid="order-status">
                        {t(`statuses.${order.status}`)}
                      </span>
                    </td>
                    <td style={td}>{formatWarsawDate(order.createdAt, locale)}</td>
                    <td style={td}>
                      {next.length === 0 ? (
                        <span style={muted}>{t('final')}</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {next.map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => void move(order, status)}
                              disabled={busyId === order.id}
                              data-testid={`move-${status}`}
                              style={{
                                ...button,
                                color:
                                  status === 'CANCELLED'
                                    ? 'var(--bobr-danger)'
                                    : 'var(--bobr-fg)',
                              }}
                            >
                              {t(`moveTo.${status}`)}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

const tableWrap: React.CSSProperties = {
  maxWidth: '100%',
  overflowX: 'auto',
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius)',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--bobr-text-sm)',
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.6rem 0.75rem',
  fontSize: 'var(--bobr-text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--bobr-fg-muted)',
  borderBottom: '1px solid var(--bobr-border)',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid var(--bobr-border)',
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
};

const muted: React.CSSProperties = { color: 'var(--bobr-fg-muted)' };

const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.15rem 0.5rem',
  fontSize: 'var(--bobr-text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
};

const button: React.CSSProperties = {
  padding: '0.35rem 0.7rem',
  font: 'inherit',
  fontWeight: 600,
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
  cursor: 'pointer',
};

const errorText: React.CSSProperties = {
  color: 'var(--bobr-danger)',
  whiteSpace: 'pre-line',
};
