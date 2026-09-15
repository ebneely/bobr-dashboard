import { apiFetch } from './client';

/** Staff overview counters (gap G22). Mirrors `GET /v1/admin-summary`. */
export interface AdminSummary {
  pendingOrders: number;
  deliveriesToday: number;
  unpaidOrders: number;
  unansweredNotes: number;
  overdueComplaints: number;
  requestedConsultations: number;
  unpaidConsultations: number;
}

export function apiGetAdminSummary() {
  return apiFetch<AdminSummary>('/admin-summary');
}

/** Where each counter's card leads. */
export const SUMMARY_LINKS: Record<keyof AdminSummary, string> = {
  pendingOrders: '/dashboard/orders',
  deliveriesToday: '/dashboard/deliveries',
  unpaidOrders: '/dashboard/orders',
  unansweredNotes: '/dashboard/notes',
  overdueComplaints: '/dashboard/notes',
  requestedConsultations: '/dashboard/consultations',
  unpaidConsultations: '/dashboard/consultations',
};

export const SUMMARY_KEYS: readonly (keyof AdminSummary)[] = [
  'pendingOrders',
  'deliveriesToday',
  'unpaidOrders',
  'unansweredNotes',
  'overdueComplaints',
  'requestedConsultations',
  'unpaidConsultations',
];
