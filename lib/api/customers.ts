import { apiFetch, apiFetchWithHeaders, readTotalCount } from './client';
import type { ConsultationStatus } from './consultations';
import type { Allergen } from './menu';
import type { OrderStatus } from './orders';

/**
 * Admin: the customer list and detail. Mirrors `GET /v1/customers/admin` and
 * `GET /v1/customers/admin/:id` in bobr_backend (STAFF only, gaps G16, G21).
 */
export interface AdminCustomer {
  id: string;
  /** Empty string when the user never gave a full name — show the email then. */
  name: string;
  email: string;
  createdAt: string;
  /** Null until the intake profile is complete (the checkout gate). */
  intakeCompletedAt: string | null;
  orderCount: number;
  lastOrderAt: string | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
}

/** `q` matches name, email or phone; every word must match (ebneely/bobr-backend#59). */
export function apiAdminListCustomers(
  page = 1,
  limit = 50,
  q = '',
): Promise<PagedResult<AdminCustomer>> {
  const search = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : '';
  return apiFetchWithHeaders<AdminCustomer[]>(
    `/customers/admin?page=${page}&limit=${limit}${search}`,
  ).then(({ data, headers }) => ({
    items: data,
    total: readTotalCount(headers, data.length),
  }));
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  locale: 'PL' | 'EN';
  createdAt: string;
}

export interface CustomerIntake {
  weightKg: string | number | null;
  heightCm: number | null;
  bodyComposition: string | null;
  activityTypes: string[];
  activityOther: string | null;
  allergens: Allergen[];
  dietaryNotes: string | null;
  completedAt: string | null;
  /** Position → short-lived URL (never a storage key). */
  photos: Record<string, string>;
}

export interface CustomerOrderSummary {
  id: string;
  mode: 'ONE_TIME' | 'CALENDAR';
  status: OrderStatus;
  /** What the acting staff member may move it to next (bobr-backend#67). */
  allowedNext: OrderStatus[];
  totalGrosze: number;
  adjustedTotalGrosze: number | null;
  paidAt: string | null;
  createdAt: string;
  meal: { namePl: string; nameEn: string; type: string } | null;
}

export interface CustomerNoteSummary {
  id: string;
  kind: 'NUDGE' | 'COMPLAINT' | 'NOTE';
  body: string;
  adminReply: string | null;
  repliedAt: string | null;
  resolution: 'ACCEPTED' | 'REJECTED' | 'INFO' | null;
  createdAt: string;
}

export interface CustomerConsultationSummary {
  id: string;
  status: ConsultationStatus;
  /** What the acting staff member may move it to next (bobr-backend#67). */
  allowedNext: ConsultationStatus[];
  scheduledAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface CustomerWeightEntry {
  id: string;
  measuredOn: string;
  weightKg: string | number;
  note: string | null;
}

export interface AdminCustomerDetail {
  profile: CustomerProfile;
  intake: CustomerIntake | null;
  orders: CustomerOrderSummary[];
  notes: CustomerNoteSummary[];
  consultations: CustomerConsultationSummary[];
  weightEntries: CustomerWeightEntry[];
}

export function apiAdminGetCustomer(id: string) {
  return apiFetch<AdminCustomerDetail>(`/customers/admin/${id}`);
}
