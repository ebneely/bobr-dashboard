import { renderHook } from '@testing-library/react';

import { formatApiError } from '@/lib/api/client';
import { localiseErrorParams, useApiErrorTranslate } from '@/lib/api/use-api-error';
import en from '@/messages/en.json';
import pl from '@/messages/pl.json';

/**
 * next-intl ships ESM only, which this Jest setup does not transform, so the
 * hook's `useTranslations('apiErrors')` is stood in for by a lookup into the
 * real Polish messages. That still proves the key mapping the hook owns.
 */
jest.mock('next-intl', () => {
  const messages = jest.requireActual('../messages/pl.json').apiErrors;
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
  const t = Object.assign(
    (key: string, params?: Record<string, string | number>) =>
      String(lookup(key)).replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? '')),
    { has: (key: string) => typeof lookup(key) === 'string' },
  );
  return { useTranslations: () => t, useLocale: () => 'pl' };
});

/** "20,00 zł" with Intl's non-breaking spaces made plain, for readable asserts. */
const plain = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

describe('useApiErrorTranslate', () => {
  const translate = renderHook(() => useApiErrorTranslate()).result.current;

  it('reads apiErrors.codes.<code> with params', () => {
    expect(
      formatApiError(
        {
          statusCode: 409,
          message: 'english',
          error: 'Conflict',
          code: 'ZONE_PREFIX_CLASH',
          params: { prefix: '00', zone: 'Warszawa' },
        },
        translate,
      ),
    ).toBe('Prefiks 00 należy już do aktywnej strefy „Warszawa”.');
  });

  it('maps field:<path> to apiErrors.fields with dots as underscores', () => {
    expect(translate('field:blikPhone')).toBe('Telefon BLIK');
    expect(translate('field:delivery.postalCode')).toBeNull();
  });

  it('shows a *Grosze param as złoty, not raw grosze (bobr-dashboard#52)', () => {
    expect(
      plain(
        formatApiError(
          {
            statusCode: 422,
            message: 'english',
            error: 'Unprocessable Entity',
            code: 'ADJUSTED_BELOW_PAID',
            params: { paidGrosze: 2000 },
          },
          translate,
        ),
      ),
    ).toBe('Kwota nie może być niższa niż już wpłacona (20,00 zł).');
    expect(plain(translate('PAYMENT_EXCEEDS_DUE', { outstandingGrosze: 3050 }))).toBe(
      'To więcej, niż pozostało do zapłaty (30,50 zł).',
    );
  });

  it('returns null for a code without wording', () => {
    expect(translate('BRAND_NEW')).toBeNull();
  });

  it('has the same codes and fields in both locales', () => {
    expect(Object.keys(pl.apiErrors.codes).sort()).toEqual(Object.keys(en.apiErrors.codes).sort());
    expect(Object.keys(pl.apiErrors.fields).sort()).toEqual(
      Object.keys(en.apiErrors.fields).sort(),
    );
  });
});

describe('localiseErrorParams', () => {
  it('formats every param ending in Grosze for the locale and leaves the rest', () => {
    const out = localiseErrorParams(
      { paidGrosze: 2000, outstandingGrosze: 5, zone: 'Warszawa', count: 3 },
      'en',
    );
    expect(plain(String(out?.paidGrosze))).toBe('PLN 20.00');
    expect(plain(String(out?.outstandingGrosze))).toBe('PLN 0.05');
    expect(out?.zone).toBe('Warszawa');
    expect(out?.count).toBe(3);
  });

  it('passes through undefined and non-numeric grosze untouched', () => {
    expect(localiseErrorParams(undefined, 'pl')).toBeUndefined();
    expect(localiseErrorParams({ paidGrosze: 'n/a' }, 'pl')).toEqual({ paidGrosze: 'n/a' });
  });
});
