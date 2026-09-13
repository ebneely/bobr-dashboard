import { apiFetch } from './client';

/**
 * Shop-wide settings. Mirrors bobr_backend/src/settings/.
 *
 * One-time shipping now comes from delivery zones (lib/api/delivery-zones.ts).
 * The flat value below stays in the backend only as the fallback for the old
 * storefront, which places orders without an address; the dashboard no longer
 * edits it.
 */

/**
 * Where a customer sends a BLIK phone transfer for a consultation.
 * `blikPhone` is stored normalised as "+48XXXXXXXXX".
 */
export interface PaymentSettings {
  blikPhone: string | null;
  blikRecipientName: string | null;
}

/** Any signed-in role. */
export function apiGetPaymentSettings() {
  return apiFetch<PaymentSettings>('/settings/payment');
}

/**
 * ADMIN only. The backend accepts spaces, dashes and an optional +48 / 0048,
 * normalises to +48XXXXXXXXX, and answers 422 to anything else.
 */
export function apiAdminSetPaymentSettings(input: PaymentSettings) {
  return apiFetch<PaymentSettings>('/settings/admin/payment', {
    method: 'PATCH',
    body: input,
  });
}

/** "+48600123456" → "+48 600 123 456". Anything unexpected is returned as-is. */
export function formatBlikPhone(phone: string): string {
  const match = /^\+48(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return match ? `+48 ${match[1]} ${match[2]} ${match[3]}` : phone;
}
