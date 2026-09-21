import { TZDate } from '@date-fns/tz';
import { addDays, format } from 'date-fns';

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
  /**
   * What this day may move to next, from the backend's one table
   * (ebneely/bobr-backend#67). DELIVERED and FAILED are already dropped when
   * the order is not CONFIRMED/PROCESSING, so an `orderPending` stop never
   * offers them. `[]` for a terminal day.
   */
  allowedNext: DeliveryDayStatus[];
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

export function apiSetDeliveryDayStatus(
  dayId: string,
  input: { status: DeliveryDayStatus; failReason?: string },
) {
  return apiFetch<{ id: string; status: DeliveryDayStatus; allowedNext: DeliveryDayStatus[] }>(
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

/**
 * Warsaw "tomorrow" as `YYYY-MM-DD` — the deliveries page's default date.
 * The calendar day after today IN WARSAW, whatever zone the browser runs in.
 */
export function warsawTomorrowIso(now: Date = new Date()): string {
  return format(addDays(new TZDate(now.getTime(), 'Europe/Warsaw'), 1), 'yyyy-MM-dd');
}
