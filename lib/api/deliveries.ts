import { apiFetch } from './client';

/**
 * The kitchen and courier operations screen. Mirrors
 * `bobr_backend/src/deliveries/` (gaps G13, G17, G18). Staff only.
 */

export type DeliveryDayStatus =
  | 'SCHEDULED'
  | 'DELIVERED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export interface ProductionRow {
  mealId: string;
  type: string;
  namePl: string;
  count: number;
  allergens: string[];
}

export interface DeliveryStop {
  orderDayId: string;
  orderId: string;
  dayStatus: DeliveryDayStatus;
  /** The order itself is not yet CONFIRMED — listed anyway, flagged. */
  orderPending: boolean;
  mealType: string;
  mealNamePl: string;
  customerName: string;
  phone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  zoneNamePl: string | null;
  deliveryNotes: string | null;
  allergens: string[];
  codToCollectGrosze: number | null;
  paid: boolean;
}

export interface AdminDeliveriesView {
  date: string;
  production: ProductionRow[];
  stops: DeliveryStop[];
}

/** `date` is `YYYY-MM-DD`; omitted, the backend defaults to Warsaw tomorrow. */
export function apiAdminListDeliveries(date?: string) {
  const query = date ? `?date=${date}` : '';
  return apiFetch<AdminDeliveriesView>(`/deliveries/admin${query}`);
}

/**
 * Legal moves for one delivery day — a copy of `DAY_TRANSITIONS` in
 * `bobr_backend/src/deliveries/deliveries.service.ts`. Only offer what the
 * backend will actually accept; it enforces the rule regardless.
 */
export const DAY_TRANSITIONS: Readonly<
  Record<DeliveryDayStatus, readonly DeliveryDayStatus[]>
> = {
  SCHEDULED: ['DELIVERED', 'FAILED', 'CANCELLED'],
  FAILED: ['DELIVERED'],
  DELIVERED: [],
  SKIPPED: [],
  CANCELLED: [],
};

export function apiSetDeliveryDayStatus(
  dayId: string,
  input: { status: DeliveryDayStatus; failReason?: string },
) {
  return apiFetch<{ id: string; status: DeliveryDayStatus }>(
    `/deliveries/admin/days/${dayId}`,
    { method: 'PATCH', body: input },
  );
}

export function apiRecordDeliveryPayment(
  orderId: string,
  input: { paidGrosze: number; paymentNote?: string },
) {
  // paidAt is set only once paidGrosze reaches the amount due
  // (ebneely/bobr-backend#58); a part payment comes back with paidAt null.
  return apiFetch<{
    id: string;
    paidAt: string | null;
    paidGrosze: number | null;
    paymentNote: string | null;
  }>(
    `/deliveries/admin/orders/${orderId}/payment`,
    { method: 'PATCH', body: input },
  );
}

/** Warsaw "today" as `YYYY-MM-DD`, for the date picker's minimum and default+1. */
export function warsawTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Warsaw "tomorrow" as `YYYY-MM-DD` — the deliveries page's default date. */
export function warsawTomorrowIso(now: Date = new Date()): string {
  const [y, m, d] = warsawTodayIso(now).split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}
