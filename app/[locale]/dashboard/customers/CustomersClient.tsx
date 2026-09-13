'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { ApiError, formatApiError } from '@/lib/api/client';
import { apiAdminListCustomers, type AdminCustomer } from '@/lib/api/customers';
import { formatWarsawDate } from '@/lib/api/orders';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

export function CustomersClient() {
  const t = useTranslations('adminCustomers');
  const locale = useLocale();

  const [customers, setCustomers] = useState<AdminCustomer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // State is only set from the promise callbacks — see MealsClient for why.
  useEffect(() => {
    let alive = true;
    apiAdminListCustomers()
      .then((rows) => {
        if (alive) setCustomers(rows);
      })
      .catch((err: unknown) => {
        if (alive) {
          setCustomers([]);
          setError(describeError(err, t('loadFailed')));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (customers === null) {
    return <p style={muted}>{t('loading')}</p>;
  }
  if (error) {
    return (
      <p role="alert" style={errorText}>
        {error}
      </p>
    );
  }
  if (customers.length === 0) {
    return <p style={muted}>{t('none')}</p>;
  }

  return (
    // The wrapper scrolls, never the page — a phone gets no sideways body scroll.
    <div style={tableWrap}>
      <table style={tableStyle} data-testid="customers-table">
        <thead>
          <tr>
            <th style={th}>{t('customer')}</th>
            <th style={th}>{t('joined')}</th>
            <th style={th}>{t('intake')}</th>
            <th style={{ ...th, textAlign: 'right' }}>{t('orders')}</th>
            <th style={th}>{t('lastOrder')}</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} data-testid="customer-row" data-email={c.email}>
              <td style={td}>
                {/* `name` is "" when no full name was given; the email stands in. */}
                <div style={{ fontWeight: 600 }}>{c.name || c.email}</div>
                {c.name && <div style={muted}>{c.email}</div>}
              </td>
              <td style={td}>{formatWarsawDate(c.createdAt, locale)}</td>
              <td style={td} data-testid="customer-intake">
                {c.intakeCompletedAt ? (
                  <>
                    <span style={{ ...badge, color: 'var(--bobr-accent-hover)', borderColor: 'var(--bobr-accent)' }}>
                      {t('yes')}
                    </span>{' '}
                    <span style={muted}>{formatWarsawDate(c.intakeCompletedAt, locale)}</span>
                  </>
                ) : (
                  <span style={badge}>{t('no')}</span>
                )}
              </td>
              <td style={{ ...td, textAlign: 'right' }} data-testid="customer-orders">
                {c.orderCount}
              </td>
              <td style={td}>
                {c.lastOrderAt ? formatWarsawDate(c.lastOrderAt, locale) : <span style={muted}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

const errorText: React.CSSProperties = {
  color: 'var(--bobr-danger)',
  whiteSpace: 'pre-line',
};
