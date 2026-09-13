import { formatApiError, type ApiErrorTranslate } from '@/lib/api/client';

const words: Record<string, string> = {
  ZONE_PREFIX_CLASH: 'Prefiks {prefix} należy już do strefy „{zone}”.',
  BLIK_PHONE_FORMAT: 'Podaj polski numer telefonu do BLIK.',
  TOO_SHORT: 'Wpisz co najmniej {minimum} znaki.',
  'field:blikPhone': 'Telefon BLIK',
};

/** A stand-in for useApiErrorTranslate: known keys interpolate, unknown ones are null. */
const translate: ApiErrorTranslate = (code, params) => {
  const text = words[code];
  if (text === undefined) return null;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''));
};

describe('formatApiError', () => {
  it('renders zod field issues as field: issue', () => {
    expect(
      formatApiError({
        statusCode: 400,
        message: [{ field: 'weightKg', issue: 'Required' }],
        error: 'Bad Request',
      }),
    ).toBe('weightKg: Required');
  });

  it('returns an empty string for a missing body', () => {
    expect(formatApiError(null)).toBe('');
    expect(formatApiError(undefined, translate)).toBe('');
  });

  it('translates a top-level code with its params', () => {
    expect(
      formatApiError(
        {
          statusCode: 409,
          message: 'Prefix 00 already belongs to active zone Warszawa',
          error: 'Conflict',
          code: 'ZONE_PREFIX_CLASH',
          params: { prefix: '00', zone: 'Warszawa' },
        },
        translate,
      ),
    ).toBe('Prefiks 00 należy już do strefy „Warszawa”.');
  });

  it('falls back to the English message for an unknown code', () => {
    expect(
      formatApiError(
        { statusCode: 400, message: 'Something new', error: 'Bad Request', code: 'BRAND_NEW' },
        translate,
      ),
    ).toBe('Something new');
  });

  it('prefixes a translated field issue with its label when one exists', () => {
    expect(
      formatApiError(
        {
          statusCode: 422,
          message: [
            { field: 'blikPhone', issue: 'Not a Polish phone', code: 'BLIK_PHONE_FORMAT' },
            { field: 'note', issue: 'Too short', code: 'TOO_SHORT', params: { minimum: 3 } },
            { field: 'other', issue: 'Odd', code: 'BRAND_NEW' },
          ],
          error: 'Unprocessable Entity',
          code: 'VALIDATION_FAILED',
        },
        translate,
      ),
    ).toBe(
      'Telefon BLIK: Podaj polski numer telefonu do BLIK.\nWpisz co najmniej 3 znaki.\nother: Odd',
    );
  });

  it('leaves an old body without code unchanged, even with translate', () => {
    const body = {
      statusCode: 400,
      message: ['first', 'second'],
      error: 'Bad Request',
    };
    expect(formatApiError(body, translate)).toBe('first\nsecond');
    expect(formatApiError({ ...body, message: 'plain' }, translate)).toBe('plain');
  });
});
