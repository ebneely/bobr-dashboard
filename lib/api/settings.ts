import { apiFetch } from './client';
import { uploadFileName } from '@/lib/image-crop';

/**
 * Shop-wide settings. Mirrors bobr_backend/src/settings/.
 *
 * Every setting the owner can change lives in ONE registry on the backend
 * (src/settings/settings.registry.ts). The dashboard never hard-codes a
 * setting: it reads the registry's schema and renders a control per field
 * (app/[locale]/dashboard/settings/). The contract is pinned in
 * https://github.com/ebneely/bobr-backend/issues/57#issuecomment-5762911150.
 */

// ---------------------------------------------------------------------------
// Registry schema
// ---------------------------------------------------------------------------

export type SettingControl =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'select'
  | 'radio'
  | 'toggle'
  | 'weekdays'
  | 'time'
  | 'localizedText'
  | 'list'
  | 'image';

export type SettingUnit = 'grosze' | 'days' | 'months' | 'hours' | 'minutes' | 'percent';

export interface SettingValidation {
  integer?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  uniqueBy?: string;
  sortedBy?: string;
  format?: string;
  pattern?: string;
  [rule: string]: unknown;
}

export interface SettingOption {
  value: string | number;
  labelKey: string;
}

/** A column of a `list` setting: the same shape as a field, minus section. */
export interface SettingColumn {
  key: string;
  control: SettingControl;
  labelKey: string;
  helpKey?: string;
  unit?: SettingUnit;
  nullable?: boolean;
  options?: SettingOption[];
  validation?: SettingValidation;
}

export interface SettingField extends SettingColumn {
  section: string;
  helpKey: string;
  nullable: boolean;
  public: boolean;
  /** false = stored and served, but the backend does not act on it yet. */
  enforced: boolean;
  default: unknown;
  validation: SettingValidation;
  item?: { fields: SettingColumn[] };
}

export interface SettingsSection {
  id: string;
  labelKey: string;
  fields: SettingField[];
}

export interface SettingsSchema {
  version: number;
  sections: SettingsSection[];
}

/** An image setting as read. Write it only through the upload route, or null to clear. */
export interface SettingImage {
  key?: string;
  url: string;
  srcSet?: Record<string, string>;
  width?: number;
  height?: number;
}

export type SettingsValues = Record<string, unknown>;

export interface SettingsValuesResponse {
  values: SettingsValues;
  updatedAt: string;
}

/** ADMIN. Section and field order is the display order. */
export function apiAdminGetSettingsSchema() {
  return apiFetch<SettingsSchema>('/settings/admin/schema');
}

/** ADMIN. Every registry key, always present. */
export function apiAdminGetSettings() {
  return apiFetch<SettingsValuesResponse>('/settings/admin');
}

/**
 * ADMIN. A partial `{ key: value }` — only the keys sent are validated and
 * written, in one transaction. Money is integer grosze; an image key takes
 * only `null` (clear). 422 names each bad field as `key`, `key.pl` or
 * `key.<row>.<column>`.
 */
export function apiAdminPatchSettings(patch: SettingsValues) {
  return apiFetch<SettingsValuesResponse>('/settings/admin', {
    method: 'PATCH',
    body: patch,
  });
}

/** ADMIN. Field `file`; answers with every value, the new image included. */
export function apiAdminUploadSettingImage(key: string, file: Blob) {
  const form = new FormData();
  form.append('file', file, uploadFileName(file));
  return apiFetch<SettingsValuesResponse>(
    `/settings/admin/images/${encodeURIComponent(key)}`,
    { method: 'POST', body: form },
  );
}

// ---------------------------------------------------------------------------
// Closed days
// ---------------------------------------------------------------------------

/** A day nothing is delivered. `date` is a Warsaw calendar day, YYYY-MM-DD. */
export interface ClosedDay {
  date: string;
  /** Staff-facing, Polish, never shown to customers. */
  reason: string;
}

/** ADMIN. Ascending, from Warsaw today on. */
export function apiAdminListClosedDays() {
  return apiFetch<{ items: ClosedDay[] }>('/settings/admin/closed-days');
}

/** ADMIN. 409 CLOSED_DAY_EXISTS when the date is already closed. */
export function apiAdminAddClosedDay(input: ClosedDay) {
  return apiFetch<ClosedDay>('/settings/admin/closed-days', {
    method: 'POST',
    body: input,
  });
}

/** ADMIN. 204; 404 CLOSED_DAY_NOT_FOUND. */
export function apiAdminDeleteClosedDay(date: string) {
  return apiFetch<void>(`/settings/admin/closed-days/${encodeURIComponent(date)}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Payment (read by the overview's readiness checklist)
// ---------------------------------------------------------------------------

/**
 * Where a customer sends a BLIK phone transfer for a consultation.
 * `blikPhone` is stored normalised as "+48XXXXXXXXX". The same two values are
 * also registry keys, edited on the settings page.
 */
export interface PaymentSettings {
  blikPhone: string | null;
  blikRecipientName: string | null;
}

/** Any signed-in role. */
export function apiGetPaymentSettings() {
  return apiFetch<PaymentSettings>('/settings/payment');
}
