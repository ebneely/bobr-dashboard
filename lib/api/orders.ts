import { apiFetch } from './client';

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

export function apiPlaceOrder(input: {
  mealId: string;
  mode: OrderMode;
  /** YYYY-MM-DD, one per delivery day. */
  days: string[];
}) {
  return apiFetch<Order>('/orders', { method: 'POST', body: input });
}

export function apiListMyOrders() {
  return apiFetch<Order[]>('/orders');
}

export function apiGetMyOrder(id: string) {
  return apiFetch<Order>(`/orders/${id}`);
}

/** Meal tracking: mark one delivery day eaten, or undo it. */
export function apiTrackDay(dayId: string, eaten: boolean) {
  return apiFetch<OrderDay>(`/orders/days/${dayId}`, {
    method: 'PATCH',
    body: { eaten },
  });
}

export function apiRaiseNote(input: {
  kind: NoteKind;
  body: string;
  orderId?: string | null;
}) {
  return apiFetch<CustomerNote>('/notes', { method: 'POST', body: input });
}

export function apiListMyNotes() {
  return apiFetch<CustomerNote[]>('/notes');
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
}

export interface AdminNote extends CustomerNote {
  user?: { id: string; email: string; fullName: string | null };
  order?: { id: string; totalGrosze: number; status: OrderStatus } | null;
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

export function apiAdminSetOrderStatus(id: string, status: OrderStatus) {
  return apiFetch<Order>(`/orders/admin/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

/** Unanswered first — the reason to open this screen is to find what needs a reply. */
export function apiAdminListNotes(onlyUnanswered = false) {
  return apiFetch<AdminNote[]>(
    `/notes/admin${onlyUnanswered ? '?unanswered=true' : ''}`,
  );
}

export function apiAdminReplyToNote(id: string, adminReply: string) {
  return apiFetch<AdminNote>(`/notes/admin/${id}/reply`, {
    method: 'PATCH',
    body: { adminReply },
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
}

export interface MealInput {
  type: MealType;
  namePl: string;
  nameEn: string;
  descriptionPl?: string | null;
  descriptionEn?: string | null;
  priceGrosze: number;
  isActive?: boolean;
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
export function apiAdminUploadMealImage(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
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
