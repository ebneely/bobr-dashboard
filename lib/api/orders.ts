import { apiFetch, apiFetchWithHeaders, readTotalCount } from './client';
import { uploadFileName } from '@/lib/image-crop';
import type { Allergen } from './menu';

export interface PagedResult<T> {
  items: T[];
  total: number;
}

/**
 * Orders and the customer's notes.
 *
 * Mirrors `bobr_backend/src/orders/` and `src/notes/`. Note what is NOT sent
 * when placing an order: no price, no discount, no total. The client names a
 * meal and some dates; every figure is computed server-side. Sending a price
 * would let anyone order at any price.
 */

export type OrderMode = 'ONE_TIME' | 'CALENDAR';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'CANCELLED';

export type NoteKind = 'NUDGE' | 'COMPLAINT' | 'NOTE';

export interface OrderDay {
  id: string;
  /** ISO date. A delivery DAY in Warsaw, not an instant. */
  deliverOn: string;
  eaten: boolean;
  eatenAt: string | null;
}

export interface Order {
  id: string;
  mode: OrderMode;
  status: OrderStatus;
  paymentMethod: 'COD';
  /** All money is integer grosze. Divide by 100 only at the point of display. */
  unitPriceGrosze: number;
  goodsGrosze: number;
  discountPercent: number;
  discountGrosze: number;
  shippingGrosze: number;
  totalGrosze: number;
  createdAt: string;
  days: OrderDay[];
  meal?: { namePl: string; nameEn: string; type: string };
  /** Null for orders placed by the old storefront, which sent no address. */
  delivery: OrderDelivery | null;
}

export interface OrderDelivery {
  addressLine: string;
  city: string;
  /** "NN-NNN". */
  postalCode: string;
  zoneId: string;
  zoneNamePl: string;
  zoneNameEn: string;
}

export interface CustomerNote {
  id: string;
  kind: NoteKind;
  body: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  orderId: string | null;
}

/**
 * Formats grosze as PLN.
 *
 * The ONLY place integer grosze become a decimal, and it happens at display
 * time. Dividing earlier puts a float into the arithmetic, and float money is
 * wrong in the third decimal place where nobody looks.
 */
export function formatGrosze(grosze: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    style: 'currency',
    currency: 'PLN',
  }).format(grosze / 100);
}

/**
 * Formats an INSTANT (createdAt, completedAt…) as a calendar date in Warsaw.
 *
 * Not for delivery days: those are DATE columns that arrive as midnight UTC
 * and must be formatted with `timeZone: 'UTC'`, or they shift back a day. An
 * instant is the opposite case — the day it fell on is the day in Warsaw, not
 * the day in whatever zone the browser or the server runs.
 */
export function formatWarsawDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Admin
//
// These exist only in the dashboard's copy of this file. The storefront has no
// business being able to call them, and the surest way to keep it that way is
// for the functions not to be there at all.
// ---------------------------------------------------------------------------

export interface AdminOrder extends Order {
  user?: { id: string; email: string; fullName: string | null };
  /** Gap G18 — cash-on-delivery collection, recorded from the deliveries screen. */
  paidAt?: string | null;
  paidGrosze?: number | null;
  /** What is actually due when an admin adjusted the total; else totalGrosze. */
  adjustedTotalGrosze?: number | null;
  paymentNote?: string | null;
  contactPhone?: string | null;
  deliveryNotes?: string | null;
  /** Issue #51 — set when the order was cancelled; staff must give a reason. */
  cancelReason?: string | null;
  cancelledAt?: string | null;
  /** The acting staff user; null when the customer cancelled their own order. */
  cancelledById?: string | null;
  /** The latest total adjustment, read back from the audit log. */
  totalAdjustment?: TotalAdjustment | null;
}

export interface TotalAdjustment {
  note: string | null;
  adjustedById: string | null;
  adjustedAt: string;
}

/** Trimmed length bounds of a staff cancellation reason (backend: 3..500). */
export const CANCEL_REASON_MIN = 3;
export const CANCEL_REASON_MAX = 500;
/** Upper bound of a total-adjustment note (backend: trimmed, ≤ 500). */
export const ADJUST_NOTE_MAX = 500;

export type ComplaintResolution = 'ACCEPTED' | 'REJECTED' | 'INFO';

export interface AdminNote extends CustomerNote {
  user?: { id: string; email: string; fullName: string | null };
  order?: { id: string; totalGrosze: number; status: OrderStatus } | null;
  /** Gap G33 — a COMPLAINT has a 14-day due date; other kinds carry null. */
  dueAt: string | null;
  overdue: boolean;
  resolution: ComplaintResolution | null;
}

export function apiAdminListOrders(status?: OrderStatus) {
  const query = status ? `?status=${status}` : '';
  return apiFetch<AdminOrder[]>(`/orders/admin${query}`);
}

/**
 * The order lifecycle — a copy of `ALLOWED_TRANSITIONS` in
 * bobr_backend/src/orders/orders.service.ts. Change both together.
 *
 * The backend refuses an illegal move regardless; this copy exists so the UI
 * only ever OFFERS a legal one, instead of offering five buttons and answering
 * four of them with a 400. Terminal states list nothing.
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function nextStatuses(status: OrderStatus): readonly OrderStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

/**
 * Moves an order along its lifecycle. CANCELLED requires `cancelReason`
 * (trimmed, 3..500 chars); every other status must NOT carry one — the backend
 * answers either mistake with a 422 — so the reason is only put on the wire
 * for a cancel.
 */
export function apiAdminSetOrderStatus(
  id: string,
  status: OrderStatus,
  cancelReason?: string,
) {
  const body =
    status === 'CANCELLED' ? { status, cancelReason: cancelReason?.trim() } : { status };
  return apiFetch<AdminOrder>(`/orders/admin/${id}/status`, {
    method: 'PATCH',
    body,
  });
}

/**
 * Overrides what the customer owes. `adjustedTotalGrosze` is integer grosze —
 * convert with zloteToGrosze, never a float — or null to clear the override,
 * which puts the order back to owing `totalGrosze`.
 */
export function apiAdminAdjustOrderTotal(
  id: string,
  input: { adjustedTotalGrosze: number | null; note?: string },
) {
  return apiFetch<AdminOrder>(`/orders/admin/${id}/total`, {
    method: 'PATCH',
    body: input,
  });
}

/** Unanswered first — the reason to open this screen is to find what needs a reply. */
export function apiAdminListNotes(
  onlyUnanswered = false,
  page = 1,
  limit = 50,
): Promise<PagedResult<AdminNote>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (onlyUnanswered) query.set('unanswered', 'true');
  return apiFetchWithHeaders<AdminNote[]>(`/notes/admin?${query}`).then(
    ({ data, headers }) => ({ items: data, total: readTotalCount(headers, data.length) }),
  );
}

export function apiAdminReplyToNote(
  id: string,
  input: {
    adminReply: string;
    resolution?: ComplaintResolution;
    overwrite?: boolean;
  },
) {
  return apiFetch<AdminNote>(`/notes/admin/${id}/reply`, {
    method: 'PATCH',
    body: input,
  });
}

// ---------------------------------------------------------------------------
// Admin: the meal catalogue
//
// Mirrors bobr_backend/src/catalog/admin-catalog.controller.ts. The admin list
// is the MANAGEMENT view — it includes deactivated meals, which the public
// `GET /meals` deliberately hides.
// ---------------------------------------------------------------------------

export type MealType = 'KETOGENIC' | 'GLUTEN_FREE' | 'ALLERGIES';

export const MEAL_TYPES: readonly MealType[] = [
  'KETOGENIC',
  'GLUTEN_FREE',
  'ALLERGIES',
];

/**
 * A meal as the ADMIN endpoints return it.
 *
 * `imageKey` is the storage object key and never renderable on its own; the
 * API resolves it to `imageUrl` at read time. The list endpoint returns the
 * raw row and so carries no `imageUrl` at all, and the upload endpoint returns
 * one that is null whenever no bucket is configured. Both cases mean the same
 * thing to the UI — no picture to show — so both must land on the placeholder
 * rather than on an <img> pointed at nothing.
 */
export interface AdminMeal {
  id: string;
  type: MealType;
  namePl: string;
  nameEn: string;
  descriptionPl: string | null;
  descriptionEn: string | null;
  /** Integer grosze, as everywhere else. */
  priceGrosze: number;
  isActive: boolean;
  imageKey: string | null;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Gap G15 — allergens present in this diet; kcal is the typical daily energy. */
  allergens: Allergen[];
  kcal: number | null;
  /** Issue #51 — the VAT rate on this meal, one of VAT_RATES. DB default 8. */
  vatRatePercent?: VatRate;
}

/** The only VAT rates the backend accepts for a meal (Polish rates). */
export const VAT_RATES = [0, 5, 8, 23] as const;
export type VatRate = (typeof VAT_RATES)[number];
export const DEFAULT_VAT_RATE: VatRate = 8;

export interface MealInput {
  type: MealType;
  namePl: string;
  nameEn: string;
  descriptionPl?: string | null;
  descriptionEn?: string | null;
  priceGrosze: number;
  isActive?: boolean;
  allergens?: Allergen[];
  kcal?: number | null;
  /** Sent as a JSON number; "8" or null is a 422 VAT_RATE_INVALID. */
  vatRatePercent?: VatRate;
}

/** Every meal, deactivated ones included. */
export function apiAdminListMeals() {
  return apiFetch<AdminMeal[]>('/meals/admin');
}

export function apiAdminCreateMeal(input: MealInput) {
  return apiFetch<AdminMeal>('/meals/admin', { method: 'POST', body: input });
}

export function apiAdminUpdateMeal(id: string, input: Partial<MealInput>) {
  return apiFetch<AdminMeal>(`/meals/admin/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

/**
 * Replaces the meal's photograph.
 *
 * The body is a FormData and the field name is `file`, matching the backend's
 * FileInterceptor. No Content-Type is set here on purpose — apiFetch omits it
 * for FormData so the browser can add its own multipart boundary, and forcing
 * one makes the body unparseable server-side with no useful error.
 */
export function apiAdminUploadMealImage(id: string, file: Blob) {
  const form = new FormData();
  form.append('file', file, uploadFileName(file));
  return apiFetch<AdminMeal>(`/meals/admin/${id}/image`, {
    method: 'POST',
    body: form,
  });
}

/**
 * DEACTIVATES the meal — the endpoint is a DELETE, the effect is isActive:false.
 *
 * Orders reference meals and a placed order must keep naming what was bought,
 * so nothing is ever removed. The UI must say "deactivate", not "delete".
 */
export function apiAdminDeactivateMeal(id: string) {
  return apiFetch<AdminMeal>(`/meals/admin/${id}`, { method: 'DELETE' });
}

/**
 * The admin types złote; the API stores grosze.
 *
 * Parsed with integer arithmetic rather than `parseFloat(x) * 100`, which for
 * "45.10" gives 4509.999999999999 and rounds its way to a figure that is wrong
 * in a reconciliation nobody runs until the year is over. Returns null for
 * anything that is not a plain amount with at most two decimal places, so the
 * form can refuse it instead of sending a NaN.
 */
export function zloteToGrosze(input: string): number | null {
  const normalised = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;

  const [whole, fraction = ''] = normalised.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** The inverse, for pre-filling the edit form's price field. Never Intl — this
 *  feeds an <input>, which wants 45.00 and not "45,00 zł". */
export function groszeToZloteInput(grosze: number): string {
  const whole = Math.trunc(grosze / 100);
  const fraction = Math.abs(grosze % 100);
  return `${whole}.${String(fraction).padStart(2, '0')}`;
}
