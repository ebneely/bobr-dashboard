'use client';

import { useQueries } from '@tanstack/react-query';

import { apiAdminListZones } from '@/lib/api/delivery-zones';
import { apiAdminListMeals } from '@/lib/api/orders';
import { apiGetPaymentSettings } from '@/lib/api/settings';

/** A reason production cannot take an order, and the page that fixes it. */
export type ReadinessGap = 'meals' | 'zones' | 'blik';

export interface ReadinessInput {
  /** Each is undefined while unknown (loading or failed) — never a false alarm. */
  activeMeals?: number;
  activeZones?: number;
  blikConfigured?: boolean;
}

/**
 * The gaps that stop the shop selling (gap G12): no active meal to order, no
 * active delivery zone to deliver to, no BLIK number to pay a consultation to.
 * Only a KNOWN zero counts; a request that failed says nothing either way.
 */
export function readinessGaps(input: ReadinessInput): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];
  if (input.activeMeals === 0) gaps.push('meals');
  if (input.activeZones === 0) gaps.push('zones');
  if (input.blikConfigured === false) gaps.push('blik');
  return gaps;
}

export const READINESS_FIX_PATH: Record<ReadinessGap, string> = {
  meals: '/dashboard/meals',
  zones: '/dashboard/zones',
  blik: '/dashboard/settings',
};

/** Reads the three admin lists the overview checklist is built from. */
export function useReadiness() {
  const [meals, zones, payment] = useQueries({
    queries: [
      { queryKey: ['meals', 'admin'], queryFn: apiAdminListMeals },
      { queryKey: ['delivery-zones', 'admin'], queryFn: apiAdminListZones },
      { queryKey: ['settings', 'payment'], queryFn: apiGetPaymentSettings },
    ],
  });

  return readinessGaps({
    activeMeals: meals.data?.filter((meal) => meal.isActive).length,
    activeZones: zones.data?.filter((zone) => zone.isActive).length,
    blikConfigured: payment.data ? Boolean(payment.data.blikPhone) : undefined,
  });
}
