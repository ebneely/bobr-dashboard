import { apiFetch } from './client';

/**
 * Staff accounts. Mirrors bobr_backend/src/staff/ (ebneely/bobr-backend#36).
 * Every endpoint is SUPER_ADMIN only — an ADMIN gets a 403.
 */

export type StaffRole = 'ADMIN' | 'SUPER_ADMIN';

export interface StaffUser {
  id: string;
  /** "" when the account has no name. */
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
  /** Latest session's creation, or null if they never signed in. */
  lastSignInAt: string | null;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  /** The only role a SUPER_ADMIN may create today. */
  role: 'ADMIN';
}

/** `temporaryPassword` is returned exactly once and never readable again. */
export interface CreateStaffResponse {
  user: StaffUser;
  temporaryPassword: string;
}

export function apiAdminListStaff() {
  return apiFetch<StaffUser[]>('/staff/admin');
}

export function apiAdminCreateStaff(input: CreateStaffInput) {
  return apiFetch<CreateStaffResponse>('/staff/admin', { method: 'POST', body: input });
}

/** New temporary password; the user must change it and every session is revoked. */
export function apiAdminResetStaffPassword(id: string) {
  return apiFetch<{ temporaryPassword: string }>(`/staff/admin/${id}/reset-password`, {
    method: 'POST',
  });
}

/** Rename and/or (de)activate. Deactivating revokes every session. */
export function apiAdminUpdateStaff(id: string, input: { name?: string; isActive?: boolean }) {
  return apiFetch<StaffUser>(`/staff/admin/${id}`, { method: 'PATCH', body: input });
}

/**
 * Whether a row offers actions. The backend refuses yourself and any other
 * SUPER_ADMIN with 409s; the UI simply does not offer them.
 */
export function isStaffRowActionable(user: Pick<StaffUser, 'id' | 'role'>, selfId: string): boolean {
  return user.role !== 'SUPER_ADMIN' && user.id !== selfId;
}
