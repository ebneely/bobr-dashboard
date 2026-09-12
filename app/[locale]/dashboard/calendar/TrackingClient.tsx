'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import {
  apiListMyOrders,
  apiTrackDay,
  formatGrosze,
  type Order,
  type OrderDay,
} from '@/lib/api/orders';

export function TrackingClient() {
  const t = useTranslations('tracking');
  const locale = useLocale();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    apiListMyOrders()
      .then(setOrders)
      .catch(() => setError('errors.generic'));
  }, []);

  async function toggle(day: OrderDay) {
    setPending(day.id);
    // Optimistic: the tick responds immediately and is reverted if the write
    // fails. A checkbox that waits for a round trip before moving feels broken
    // even when it is working.
    setOrders((current) =>
      current?.map((order) => ({
        ...order,
        days: order.days.map((d) =>
          d.id === day.id ? { ...d, eaten: !d.eaten } : d,
        ),
      })) ?? current,
    );

    try {
      await apiTrackDay(day.id, !day.eaten);
    } catch {
      setOrders((current) =>
        current?.map((order) => ({
          ...order,
          days: order.days.map((d) =>
            d.id === day.id ? { ...d, eaten: day.eaten } : d,
          ),
        })) ?? current,
      );
      setError('errors.generic');
    } finally {
      setPending(null);
    }
  }

  if (error && !orders) return <p className="dash-error">{error}</p>;
  if (!orders) return <p>…</p>;
  if (orders.length === 0) return <p>{t('noOrders')}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {orders.map((order) => (
        <article
          key={order.id}
          style={{
            background: 'var(--bobr-surface)',
            border: '1px solid var(--bobr-border)',
            borderRadius: 'var(--bobr-radius)',
            padding: '1.25rem',
          }}
        >
          <header
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2 style={{ fontSize: 'var(--bobr-text-h4)', fontWeight: 600 }}>
                {order.meal
                  ? locale === 'pl'
                    ? order.meal.namePl
                    : order.meal.nameEn
                  : '—'}
              </h2>
              <p
                style={{
                  fontSize: 'var(--bobr-text-sm)',
                  color: 'var(--bobr-fg-muted)',
                }}
              >
                {order.days.length} {t('days')} · {t('status')}: {order.status}
                {order.discountPercent > 0 &&
                  ` · ${t('discount')} ${order.discountPercent}%`}
                {order.shippingGrosze === 0 && ` · ${t('freeShipping')}`}
              </p>
            </div>
            <strong
              style={{
                fontSize: 'var(--bobr-text-lead)',
                color: 'var(--bobr-accent)',
              }}
            >
              {formatGrosze(order.totalGrosze, locale)}
            </strong>
          </header>

          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))',
              gap: '0.5rem',
            }}
          >
            {order.days.map((day) => {
              // The column is a DATE, so it arrives as midnight UTC. Rendering
              // it with the local timezone would shift it a day for anyone west
              // of Greenwich, which is how a delivery lands on the wrong date.
              const label = new Date(day.deliverOn).toLocaleDateString(
                locale === 'pl' ? 'pl-PL' : 'en-GB',
                { day: 'numeric', month: 'short', timeZone: 'UTC' },
              );

              return (
                <li key={day.id}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.55rem 0.6rem',
                      cursor: 'pointer',
                      borderRadius: 'var(--bobr-radius-control)',
                      border: `1px solid ${day.eaten ? 'transparent' : 'var(--bobr-border)'}`,
                      background: day.eaten
                        ? 'var(--bobr-fg)'
                        : 'var(--bobr-surface)',
                      color: day.eaten
                        ? 'var(--bobr-on-dark)'
                        : 'var(--bobr-fg)',
                      opacity: pending === day.id ? 0.6 : 1,
                      fontSize: 'var(--bobr-text-sm)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={day.eaten}
                      onChange={() => toggle(day)}
                      aria-label={`${label} — ${day.eaten ? t('eaten') : t('notEaten')}`}
                    />
                    {label}
                  </label>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}
