'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import type { ApiErrorTranslate } from '@/lib/api/client';

/**
 * The `translate` argument for `formatApiError`, backed by `apiErrors` in
 * messages. Code `X` reads `apiErrors.codes.X`; `field:<path>` reads
 * `apiErrors.fields.<path with dots as underscores>`. Anything without wording
 * returns null so formatApiError falls back to the backend's English message.
 */
export function useApiErrorTranslate(): ApiErrorTranslate {
  const t = useTranslations('apiErrors');

  return useCallback<ApiErrorTranslate>(
    (code, params) => {
      const key = code.startsWith('field:')
        ? `fields.${code.slice('field:'.length).replace(/\./g, '_')}`
        : `codes.${code}`;
      if (!t.has(key)) return null;
      return t(key, params);
    },
    [t],
  );
}
