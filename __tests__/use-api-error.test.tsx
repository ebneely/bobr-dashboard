import { renderHook } from '@testing-library/react';

import { formatApiError } from '@/lib/api/client';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
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
  return { useTranslations: () => t };
});

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
