'use client';

import { useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { ApiError, formatApiError, type ApiErrorTranslate, type FieldIssue } from '@/lib/api/client';
import { formatGrosze } from '@/lib/api/orders';
import type { SettingColumn, SettingsSchema } from '@/lib/api/settings';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';

import type { DraftIssue } from './draft';

/**
 * Words for the generic settings form.
 *
 * `text(key)` reads a FULL message key as the registry schema names it
 * (`settings.fields.leadDays.label`). A key without copy yet renders as the
 * setting's own key rather than crashing the page — the i18n test is what
 * stops that from shipping.
 */
export function useSettingsText() {
  const t = useTranslations();
  const text = useCallback(
    (key: string | undefined, fallback = ''): string => (key && t.has(key) ? t(key) : fallback),
    [t],
  );
  return text;
}

/**
 * formatApiError's translator for this page: the settings-only codes live in
 * `settings.errors`, everything else in the shared `apiErrors`. A field label
 * (`field:<key>`) is the setting's own label.
 */
export function useSettingsErrorTranslate(): ApiErrorTranslate {
  const t = useTranslations('settings');
  const shared = useApiErrorTranslate();
  return useCallback<ApiErrorTranslate>(
    (code, params) => {
      if (code.startsWith('field:')) {
        const key = code.slice('field:'.length).split('.')[0];
        const label = `fields.${key}.label`;
        if (t.has(label)) return t(label);
        return shared(code, params);
      }
      if (t.has(`errors.${code}`)) return t(`errors.${code}`, params);
      return shared(code, params);
    },
    [t, shared],
  );
}

/**
 * One problem → the sentence shown under its field. Money limits arrive in
 * grosze (`maximum: 1000000`) and are shown as złoty.
 */
export function useIssueMessage() {
  const translate = useSettingsErrorTranslate();
  const locale = useLocale();
  return useCallback(
    (issue: DraftIssue, field?: SettingColumn, fallback?: string): string => {
      let params = issue.params;
      if (field?.control === 'money' && params) {
        params = Object.fromEntries(
          Object.entries(params).map(([name, value]) => [
            name,
            (name === 'minimum' || name === 'maximum') && typeof value === 'number'
              ? formatGrosze(value, locale)
              : value,
          ]),
        );
      }
      return translate(issue.code, params) ?? fallback ?? issue.code;
    },
    [translate, locale],
  );
}

/** Finds the field a 422 path belongs to: `key`, `key.pl`, `key.0.minDays`. */
export function fieldForPath(schema: SettingsSchema, path: string): SettingColumn | undefined {
  const [key, , column] = path.split('.');
  for (const section of schema.sections) {
    const field = section.fields.find((f) => f.key === key);
    if (!field) continue;
    if (column && field.item) return field.item.fields.find((c) => c.key === column) ?? field;
    return field;
  }
  return undefined;
}

/** The 422 issues of an ApiError, or null when it is not a per-field failure. */
export function fieldIssuesOf(error: unknown): FieldIssue[] | null {
  if (!(error instanceof ApiError) || !error.body) return null;
  const { message } = error.body;
  if (!Array.isArray(message)) return null;
  const issues = message.filter((m): m is FieldIssue => typeof m !== 'string');
  return issues.length ? issues : null;
}

/** A whole-request failure, worded. */
export function useDescribeError() {
  const translate = useSettingsErrorTranslate();
  return useCallback(
    (error: unknown, fallback: string) =>
      error instanceof ApiError ? formatApiError(error.body, translate) || fallback : fallback,
    [translate],
  );
}
