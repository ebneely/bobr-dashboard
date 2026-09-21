import { TZDate } from '@date-fns/tz';

import { apiFetch, apiFetchWithHeaders, readTotalCount } from './client';

export interface PagedResult<T> {
  items: T[];
  total: number;
}

/**
 * Doctor consultations. Mirrors bobr_backend/src/consultations/.
 *
 * Booking itself happens on the storefront; the dashboard lists bookings and,
 * for staff (ADMIN/SUPER_ADMIN), confirms them with a time and a Google Meet link.
 */

export type ConsultationContext = 'BEFORE_MEAL' | 'BEFORE_PLAN';

export type ConsultationStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Consultation {
  id: string;
  context: ConsultationContext;
  /** ISO instant the customer asked for. */
  preferredAt: string;
  note: string | null;
  /** Integer grosze, frozen at booking. */
  priceGrosze: number;
  status: ConsultationStatus;
  scheduledAt: string | null;
  meetUrl: string | null;
  confirmedAt: string | null;
  createdAt: string;
  /** When an ADMIN marked the BLIK transfer received; null while unpaid. */
  paidAt: string | null;
  /** "BOBR-" + first 8 hex of the id, upper case — the transfer title. */
  paymentReference: string;
}

/**
 * What staff get back from every admin consultation endpoint (list, confirm,
 * status, paid). The customer endpoints carry neither extra field.
 */
export interface StaffConsultation extends Consultation {
  /**
   * What this booking may move to next, from the backend's one table
   * (ebneely/bobr-backend#67). CONFIRMED is reached through the confirm
   * endpoint (slot + link); COMPLETED and CANCELLED through the status one.
   */
  allowedNext: ConsultationStatus[];
  /** Regex source the backend validates `meetUrl` with; `new RegExp(it)`, no flags. */
  meetUrlPattern: string;
}

export interface AdminConsultation extends StaffConsultation {
  /** `name` is "" when the customer never gave one. */
  customer: { name: string; email: string };
}

export function apiAdminListConsultations(
  page = 1,
  limit = 50,
): Promise<PagedResult<AdminConsultation>> {
  return apiFetchWithHeaders<AdminConsultation[]>(
    `/consultations/admin?page=${page}&limit=${limit}`,
  ).then(({ data, headers }) => ({
    items: data,
    total: readTotalCount(headers, data.length),
  }));
}

export function apiAdminConfirmConsultation(
  id: string,
  input: { scheduledAt: string; meetUrl: string },
) {
  return apiFetch<StaffConsultation>(`/consultations/admin/${id}/confirm`, {
    method: 'PATCH',
    body: input,
  });
}

export function apiAdminSetConsultationStatus(
  id: string,
  status: 'COMPLETED' | 'CANCELLED',
) {
  return apiFetch<StaffConsultation>(`/consultations/admin/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

/** Staff only (ADMIN, SUPER_ADMIN) — CUSTOMER gets a 403. Sets or clears `paidAt`. */
export function apiAdminSetConsultationPaid(id: string, paid: boolean) {
  return apiFetch<StaffConsultation>(`/consultations/admin/${id}/paid`, {
    method: 'PATCH',
    body: { paid },
  });
}

/**
 * Whether `value` is a link the backend will accept, judged by the pattern the
 * backend itself sends on the row (`meetUrlPattern`, the source of its
 * MEET_URL_PATTERN — ebneely/bobr-backend#67). Inline feedback only: the
 * backend validates again and answers MEET_URL. A pattern that does not
 * compile lets the value through to that server check rather than blocking
 * every confirmation.
 */
export function matchesMeetUrlPattern(value: string, pattern: string): boolean {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    return true;
  }
  return regex.test(value.trim());
}

/** The meeting code at the end of a Meet link ("abc-defg-hij"), for display. */
export function meetCode(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1) || url;
}

/** 08:00–20:00 every 30 minutes, as "HH:mm". */
export const CONFIRM_TIME_SLOTS: readonly string[] = Array.from(
  { length: 25 },
  (_, i) => {
    const minutes = 8 * 60 + i * 30;
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  },
);

/**
 * A wall-clock date ("YYYY-MM-DD") and time ("HH:mm") as the doctor means
 * them — in Warsaw — turned into a UTC ISO instant. Never the browser's zone:
 * a doctor travelling in Lisbon still means 10:00 in Warsaw. Null when either
 * part is malformed.
 */
export function warsawWallClockToIso(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const instant = new TZDate(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2]),
    0,
    'Europe/Warsaw',
  );
  if (Number.isNaN(instant.getTime())) return null;
  return new Date(instant.getTime()).toISOString();
}

/** An instant as date + time in Warsaw. */
export function formatWarsawDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(iso));
}
