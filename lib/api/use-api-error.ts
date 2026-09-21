'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';

import type { ApiErrorTranslate } from '@/lib/api/client';
import { formatGrosze } from '@/lib/api/orders';

/**
 * Error params arrive as the backend holds them: money as integer grosze, in a
 * param whose name ends in `Grosze` (`paidGrosze`, `outstandingGrosze`, …).
 * Before interpolation each such number becomes złoty for `locale`, e.g.
 * 2000 → "20,00 zł", so no message ever shows raw grosze and no new code needs
 * its own handling. Other params pass through unchanged.
 */
export function localiseErrorParams(
  params: Record<string, string | number> | undefined,
  locale: string,
): Record<string, string | number> | undefined {
  if (!params) return params;
  const out: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params)) {
    out[name] =
      name.endsWith('Grosze') && typeof value === 'number' && Number.isFinite(value)
        ? formatGrosze(value, locale)
        : value;
  }
  return out;
}

/**
 * The `translate` argument for `formatApiError`, backed by `apiErrors` in
 * messages. Code `X` reads `apiErrors.codes.X`; `field:<path>` reads
 * `apiErrors.fields.<path with dots as underscores>`. Anything without wording
 * returns null so formatApiError falls back to the backend's English message.
 */
export function useApiErrorTranslate(): ApiErrorTranslate {
  const t = useTranslations('apiErrors');
  const locale = useLocale();

  return useCallback<ApiErrorTranslate>(
    (code, params) => {
      const key = code.startsWith('field:')
        ? `fields.${code.slice('field:'.length).replace(/\./g, '_')}`
        : `codes.${code}`;
      if (!t.has(key)) return null;
      return t(key, localiseErrorParams(params, locale));
    },
    [t, locale],
  );
}
