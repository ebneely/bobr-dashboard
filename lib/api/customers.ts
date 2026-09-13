import { apiFetch } from './client';

/**
 * Admin: the customer list.
 *
 * Mirrors `GET /v1/customers/admin` in bobr_backend (ADMIN only, newest
 * first). Dashboard-only, like the other admin calls.
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

export function apiAdminListCustomers() {
  return apiFetch<AdminCustomer[]>('/customers/admin');
}
