import { TZDate } from '@date-fns/tz';

import type { Locale } from '@/lib/i18n/routing';

import { apiFetch } from './client';

/**
 * Doctor consultations. Mirrors bobr_backend/src/consultations/.
 *
 * Booking itself happens on the storefront; the dashboard lists bookings and,
 * for ADMIN/DOCTOR, confirms them with a time and a Google Meet link.
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

export interface AdminConsultation extends Consultation {
  /** `name` is "" when the customer never gave one. */
  customer: { name: string; email: string };
}

export function apiListMyConsultations() {
  return apiFetch<Consultation[]>('/consultations');
}

export function apiAdminListConsultations() {
  return apiFetch<AdminConsultation[]>('/consultations/admin');
}

export function apiAdminConfirmConsultation(
  id: string,
  input: { scheduledAt: string; meetUrl: string },
) {
  return apiFetch<Consultation>(`/consultations/admin/${id}/confirm`, {
    method: 'PATCH',
    body: input,
  });
}

export function apiAdminSetConsultationStatus(
  id: string,
  status: 'COMPLETED' | 'CANCELLED',
) {
  return apiFetch<Consultation>(`/consultations/admin/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

/** ADMIN only — DOCTOR and CUSTOMER get a 403. Sets or clears `paidAt`. */
export function apiAdminSetConsultationPaid(id: string, paid: boolean) {
  return apiFetch<Consultation>(`/consultations/admin/${id}/paid`, {
    method: 'PATCH',
    body: { paid },
  });
}

/**
 * A copy of the backend's rule, so the UI only OFFERS legal moves:
 * REQUESTED → CANCELLED (confirming is its own action); CONFIRMED →
 * COMPLETED | CANCELLED; terminal states nothing. The backend refuses the rest.
 */
export const CONSULTATION_STATUS_MOVES: Readonly<
  Record<ConsultationStatus, readonly ('COMPLETED' | 'CANCELLED')[]>
> = {
  REQUESTED: ['CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Same pattern the backend validates with (src/consultations/meet-url.ts). */
export const MEET_URL_PATTERN = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export function isMeetUrl(value: string): boolean {
  return MEET_URL_PATTERN.test(value.trim());
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

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3100';

/** The storefront page where a customer books a consultation. */
export function storefrontConsultationUrl(locale: Locale): string {
  return new URL(`/${locale}/consultation`, STOREFRONT_URL).toString();
}
