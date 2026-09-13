import { ApiError, apiFetch } from './client';

/**
 * The customer's pre-purchase intake profile — read-only in the dashboard.
 *
 * Mirrors `IntakeService.present` in bobr_backend/src/intake/intake.service.ts.
 * The storefront owns the form; the dashboard only shows what was saved and
 * points back there when something is missing.
 */

export type ActivityType = 'NONE' | 'GYM' | 'SWIMMER' | 'BOXING_MMA' | 'OTHER';

export type PhotoPosition = 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT';

export interface IntakeProfile {
  /** Prisma Decimal columns arrive as strings ("80.5"), not numbers. */
  weightKg: string | number;
  heightCm: string | number;
  bodyComposition: string | null;
  activityTypes: ActivityType[];
  activityOther: string | null;
  /** Null until measurements AND all four photos are in. The checkout gate. */
  completedAt: string | null;
  missingPhotos: PhotoPosition[];
}

/**
 * The signed-in customer's profile, or `null` when they have not started one.
 *
 * The backend answers "no profile yet" with a 404. For this screen that is a
 * normal state — a new customer — not a failure, so it is folded into null
 * here and every other error still throws.
 */
export async function apiGetMyIntake(): Promise<IntakeProfile | null> {
  try {
    return await apiFetch<IntakeProfile>('/intake/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Where the intake form lives: the storefront, not this app. */
export function storefrontIntakeUrl(locale: string): string {
  const base = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3100';
  return new URL(`/${locale}/intake`, base).toString();
}
