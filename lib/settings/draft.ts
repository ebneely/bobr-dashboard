import { groszeToZloteInput, zloteToGrosze } from '@/lib/api/orders';
import type { SettingColumn, SettingField, SettingsSchema } from '@/lib/api/settings';

/**
 * The generic settings form's model: what each control holds while it is
 * being edited (a "draft"), and how that turns back into the value the API
 * takes. One pair of functions for every control type — no setting has form
 * code of its own; the registry schema drives all of it.
 *
 * Drafts keep what the person typed (a number field holds "12" or "", money
 * holds "120,50"), so parsing happens once, on save, and a half-typed value
 * is never silently rounded.
 */

export type Draft =
  | string
  | boolean
  | number[]
  | { pl: string; en: string }
  | DraftRow[]
  | null
  | undefined;

export type DraftRow = Record<string, Draft>;

/** A problem found before sending — same `code`/`params` shape as the backend's. */
export interface DraftIssue {
  code: string;
  params?: Record<string, string | number>;
}

/**
 * `ok: false` carries issues by sub-path: '' for the field itself, 'pl' in a
 * localizedText, '<row>.<column>' in a list — the same paths the backend's 422
 * uses after the key.
 */
export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; issues: Record<string, DraftIssue> };

const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** 24h HH:mm, the backend's SETTING_TIME_FORMAT rule. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toDraft(field: SettingColumn, value: unknown, locale: string): Draft {
  switch (field.control) {
    case 'text':
    case 'textarea':
    case 'time':
      return typeof value === 'string' ? value : '';
    case 'number':
      return typeof value === 'number' ? String(value) : '';
    case 'money': {
      if (typeof value !== 'number') return '';
      const zlote = groszeToZloteInput(value);
      return locale === 'pl' ? zlote.replace('.', ',') : zlote;
    }
    case 'select':
    case 'radio':
      return value === null || value === undefined ? '' : String(value);
    case 'toggle':
      return value === true;
    case 'weekdays':
      return Array.isArray(value) ? value.filter((day): day is number => typeof day === 'number') : [];
    case 'localizedText': {
      const text = (value ?? {}) as Partial<Record<'pl' | 'en', unknown>>;
      return {
        pl: typeof text.pl === 'string' ? text.pl : '',
        en: typeof text.en === 'string' ? text.en : '',
      };
    }
    case 'list': {
      const columns = (field as SettingField).item?.fields ?? [];
      if (!Array.isArray(value)) return [];
      return value.map((row) => newRow(columns, locale, row as Record<string, unknown>));
    }
    case 'image':
    default:
      return undefined;
  }
}

/** A list row, from a stored row or blank for "add a row". */
export function newRow(
  columns: SettingColumn[],
  locale: string,
  row: Record<string, unknown> = {},
): DraftRow {
  return Object.fromEntries(columns.map((column) => [column.key, toDraft(column, row[column.key], locale)]));
}

function rangeIssue(field: SettingColumn, n: number): DraftIssue | null {
  const { min, max } = field.validation ?? {};
  if (typeof min === 'number' && n < min) return { code: 'TOO_SMALL', params: { minimum: min } };
  if (typeof max === 'number' && n > max) return { code: 'TOO_BIG', params: { maximum: max } };
  return null;
}

function single(issue: DraftIssue): ParseResult {
  return { ok: false, issues: { '': issue } };
}

export function fromDraft(field: SettingColumn, draft: Draft): ParseResult {
  switch (field.control) {
    case 'text':
    case 'textarea': {
      const text = typeof draft === 'string' ? draft.trim() : '';
      if (text === '' && field.nullable) return { ok: true, value: null };
      return { ok: true, value: text };
    }
    case 'time': {
      const text = typeof draft === 'string' ? draft.trim() : '';
      if (text === '') return field.nullable ? { ok: true, value: null } : single({ code: 'REQUIRED' });
      // "8:30" is accepted and padded; anything else gets the backend's own code.
      const time = /^(\d{1,2}):(\d{2})$/.exec(text);
      const padded = time ? `${time[1].padStart(2, '0')}:${time[2]}` : text;
      return TIME_PATTERN.test(padded)
        ? { ok: true, value: padded }
        : single({ code: 'SETTING_TIME_FORMAT' });
    }
    case 'number': {
      const text = typeof draft === 'string' ? draft.trim() : '';
      if (text === '') return field.nullable ? { ok: true, value: null } : single({ code: 'REQUIRED' });
      if (!/^-?\d+$/.test(text)) return single({ code: 'SETTING_WHOLE_NUMBER' });
      const n = Number(text);
      const issue = rangeIssue(field, n);
      return issue ? single(issue) : { ok: true, value: n };
    }
    case 'money': {
      const text = typeof draft === 'string' ? draft.trim() : '';
      if (text === '') return field.nullable ? { ok: true, value: null } : single({ code: 'REQUIRED' });
      const grosze = zloteToGrosze(text);
      if (grosze === null) return single({ code: 'SETTING_MONEY_FORMAT' });
      const issue = rangeIssue(field, grosze);
      return issue ? single(issue) : { ok: true, value: grosze };
    }
    case 'select':
    case 'radio': {
      const text = typeof draft === 'string' ? draft : '';
      if (text === '' && field.nullable) return { ok: true, value: null };
      const option = field.options?.find((o) => String(o.value) === text);
      return option ? { ok: true, value: option.value } : single({ code: 'INVALID_OPTION' });
    }
    case 'toggle':
      return { ok: true, value: draft === true };
    case 'weekdays': {
      const days = Array.isArray(draft) ? (draft as number[]) : [];
      const value = ISO_WEEKDAYS.filter((day) => days.includes(day));
      const minimum = field.validation?.minItems ?? 1;
      return value.length < minimum ? single({ code: 'DAYS_REQUIRED' }) : { ok: true, value };
    }
    case 'localizedText': {
      const text = (draft ?? { pl: '', en: '' }) as { pl: string; en: string };
      const value = { pl: text.pl.trim(), en: text.en.trim() };
      const issues: Record<string, DraftIssue> = {};
      const maxLength = field.validation?.maxLength;
      for (const lang of ['pl', 'en'] as const) {
        if (value[lang] === '') issues[lang] = { code: 'REQUIRED' };
        else if (typeof maxLength === 'number' && value[lang].length > maxLength)
          issues[lang] = { code: 'TOO_LONG', params: { maximum: maxLength } };
      }
      return Object.keys(issues).length ? { ok: false, issues } : { ok: true, value };
    }
    case 'list':
      return parseList(field as SettingField, draft);
    case 'image':
    default:
      return { ok: true, value: undefined };
  }
}

function parseList(field: SettingField, draft: Draft): ParseResult {
  const rows = Array.isArray(draft) ? (draft as DraftRow[]) : [];
  const columns = field.item?.fields ?? [];
  const issues: Record<string, DraftIssue> = {};
  const value: Record<string, unknown>[] = [];

  rows.forEach((row, index) => {
    const parsed: Record<string, unknown> = {};
    for (const column of columns) {
      const result = fromDraft(column, row[column.key]);
      if (result.ok) parsed[column.key] = result.value;
      else issues[`${index}.${column.key}`] = result.issues[''] ?? Object.values(result.issues)[0];
    }
    value.push(parsed);
  });

  const { uniqueBy, sortedBy, maxItems } = field.validation;
  if (typeof maxItems === 'number' && rows.length > maxItems) {
    issues[''] = { code: 'TOO_MANY', params: { maximum: maxItems } };
  }
  if (uniqueBy) {
    duplicateRows(rows, uniqueBy).forEach((index) => {
      issues[`${index}.${uniqueBy}`] ??= {
        code: 'SETTING_LIST_DUPLICATE',
        params: { value: String(rows[index][uniqueBy] ?? '').trim() },
      };
    });
  }
  if (Object.keys(issues).length) return { ok: false, issues };

  if (sortedBy) {
    value.sort((a, b) => Number(a[sortedBy]) - Number(b[sortedBy]));
  }
  return { ok: true, value };
}

/** Indexes of every row after the first that repeats a column's value — what gets the inline error. */
export function duplicateRows(rows: DraftRow[], column: string): number[] {
  const seen = new Set<string>();
  const repeats: number[] = [];
  rows.forEach((row, index) => {
    const raw = row[column];
    const key = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);
    if (key === '') return;
    if (seen.has(key)) repeats.push(index);
    seen.add(key);
  });
  return repeats;
}

/** True when a list's rows are not in `column` order — shown as a hint, sorted on save. */
export function isUnsorted(rows: DraftRow[], column: string): boolean {
  const numbers = rows.map((row) => Number(String(row[column] ?? '').trim()));
  return numbers.some((n, i) => i > 0 && Number.isFinite(n) && Number.isFinite(numbers[i - 1]) && n < numbers[i - 1]);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Changed = would send something different from what is stored, or cannot be parsed yet. */
export function isDirty(field: SettingField, draft: Draft, stored: unknown): boolean {
  if (field.control === 'image') return false;
  const parsed = fromDraft(field, draft);
  if (!parsed.ok) return true;
  return !same(parsed.value, stored);
}

export function draftsFor(
  schema: SettingsSchema,
  values: Record<string, unknown>,
  locale: string,
): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const section of schema.sections) {
    for (const field of section.fields) drafts[field.key] = toDraft(field, values[field.key], locale);
  }
  return drafts;
}

/**
 * The PATCH body for one section: only the changed keys. Anything that cannot
 * be parsed comes back as issues by full path (`key`, `key.pl`,
 * `key.0.minDays`) and nothing is sent.
 */
export function buildPatch(
  fields: SettingField[],
  drafts: Record<string, Draft>,
  stored: Record<string, unknown>,
):
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; issues: Record<string, DraftIssue> } {
  const patch: Record<string, unknown> = {};
  const issues: Record<string, DraftIssue> = {};
  for (const field of fields) {
    if (field.control === 'image') continue;
    const parsed = fromDraft(field, drafts[field.key]);
    if (!parsed.ok) {
      for (const [sub, issue] of Object.entries(parsed.issues)) {
        issues[sub ? `${field.key}.${sub}` : field.key] = issue;
      }
      continue;
    }
    if (!same(parsed.value, stored[field.key])) patch[field.key] = parsed.value;
  }
  return Object.keys(issues).length ? { ok: false, issues } : { ok: true, patch };
}

/** Every message key the schema makes the dashboard render. */
export function schemaMessageKeys(schema: SettingsSchema): string[] {
  const keys = new Set<string>();
  const addColumn = (column: SettingColumn) => {
    keys.add(column.labelKey);
    if (column.helpKey) keys.add(column.helpKey);
    if (column.unit && column.control !== 'money') keys.add(`settings.units.${column.unit}`);
    column.options?.forEach((option) => keys.add(option.labelKey));
  };
  for (const section of schema.sections) {
    keys.add(section.labelKey);
    for (const field of section.fields) {
      addColumn(field);
      field.item?.fields.forEach(addColumn);
    }
  }
  return [...keys];
}
