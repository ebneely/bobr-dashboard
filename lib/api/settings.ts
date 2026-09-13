import { apiFetch } from './client';

/**
 * Shop-wide settings. Mirrors bobr_backend/src/settings/.
 *
 * Only one-time shipping for now. Calendar orders always ship free, and an
 * order that is already placed keeps the shipping it was placed with — the
 * backend freezes it on the order, so changing this never rewrites history.
 */

export interface ShippingSettings {
  /** Integer grosze, 0..100000. */
  oneTimeShippingGrosze: number;
}

/** Public: the storefront shows this at checkout. */
export function apiGetShipping() {
  return apiFetch<ShippingSettings>('/settings/shipping', { auth: false });
}

/** ADMIN only — the backend answers 403 to anyone else, 422 to a bad amount. */
export function apiAdminSetShipping(oneTimeShippingGrosze: number) {
  return apiFetch<ShippingSettings>('/settings/admin/shipping', {
    method: 'PATCH',
    body: { oneTimeShippingGrosze },
  });
}
