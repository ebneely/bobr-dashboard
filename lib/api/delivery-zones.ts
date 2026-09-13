import { apiFetch } from './client';

/**
 * Delivery zones. Mirrors bobr_backend/src/delivery-zones/.
 *
 * A zone owns Polish postal-code prefixes (1–5 digits of NN-NNN, the dash
 * ignored) and a one-time shipping price. A postal code resolves to the ACTIVE
 * zone with the longest matching prefix; two active zones holding the same
 * prefix is refused by the backend with a 409. Zones are deactivated, never
 * deleted — orders reference them.
 */

export interface DeliveryZone {
  id: string;
  namePl: string;
  nameEn: string;
  postalCodePrefixes: string[];
  /** Integer grosze, 0..100000. */
  oneTimeShippingGrosze: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryZoneInput {
  namePl: string;
  nameEn: string;
  postalCodePrefixes: string[];
  oneTimeShippingGrosze: number;
  isActive?: boolean;
}

/** Every zone, inactive ones included. ADMIN only. */
export function apiAdminListZones() {
  return apiFetch<DeliveryZone[]>('/delivery-zones/admin');
}

export function apiAdminCreateZone(input: DeliveryZoneInput) {
  return apiFetch<DeliveryZone>('/delivery-zones/admin', {
    method: 'POST',
    body: input,
  });
}

export function apiAdminUpdateZone(id: string, input: Partial<DeliveryZoneInput>) {
  return apiFetch<DeliveryZone>(`/delivery-zones/admin/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

/**
 * "00, 01 02-9" → { prefixes: ["00", "01", "029"], invalid: [] }.
 *
 * Separated by commas, semicolons or whitespace; dashes are stripped because a
 * prefix is digits of NN-NNN with the dash ignored. Anything that is not 1–5
 * digits afterwards is returned in `invalid` so the form can refuse it rather
 * than silently dropping what the admin typed. Duplicates collapse.
 */
export function parsePostalPrefixes(input: string): {
  prefixes: string[];
  invalid: string[];
} {
  const prefixes: string[] = [];
  const invalid: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    if (raw === '') continue;
    const token = raw.replace(/-/g, '');
    if (/^\d{1,5}$/.test(token)) {
      if (!prefixes.includes(token)) prefixes.push(token);
    } else {
      invalid.push(raw);
    }
  }
  return { prefixes, invalid };
}
