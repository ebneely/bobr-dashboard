'use client';

import {
  AppleIcon,
  CoffeeIcon,
  CookieIcon,
  MoonStarIcon,
  SoupIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiError, formatApiError, type ApiErrorTranslate } from '@/lib/api/client';
import { ALLERGENS, type Allergen, type MenuCourse } from '@/lib/api/menu';
import { cn } from '@/lib/cn';

export const COURSE_ICON: Record<MenuCourse, LucideIcon> = {
  BREAKFAST: CoffeeIcon,
  SECOND_BREAKFAST: AppleIcon,
  LUNCH: SoupIcon,
  SNACK: CookieIcon,
  DINNER: MoonStarIcon,
};

export const MUTED_LABEL = 'text-xs font-medium tracking-wider text-muted-foreground uppercase';

/**
 * One line a person can act on. The backend's `{field, issue}[]` goes through
 * formatApiError — rendering that array directly throws React error #31.
 */
export function describeError(
  error: unknown,
  fallback: string,
  translate: ApiErrorTranslate,
): string {
  if (error instanceof ApiError) return formatApiError(error.body, translate) || fallback;
  return fallback;
}

/** "Allergen 7 — Milk": the printed EU number is what kitchens and customers know. */
export function allergenNumber(allergen: Allergen): number {
  return ALLERGENS.indexOf(allergen) + 1;
}

/**
 * The allergen marks on a dish: small numbered discs in EU order, the names in
 * a tooltip and in the accessible label. Nothing at all when there are none.
 */
export function AllergenMarks({
  allergens,
  className,
}: {
  allergens: readonly Allergen[];
  className?: string;
}) {
  const t = useTranslations('menuPage');
  if (allergens.length === 0) return null;
  const sorted = [...allergens].sort((a, b) => allergenNumber(a) - allergenNumber(b));
  const names = sorted.map((allergen) => t(`allergens.${allergen}`)).join(', ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-flex flex-wrap items-center gap-1', className)}
          aria-label={t('allergensLabel', { names })}
          tabIndex={0}
          data-testid="allergen-marks"
        >
          {sorted.map((allergen) => (
            <span
              key={allergen}
              aria-hidden
              className="inline-flex size-5 items-center justify-center rounded-full border border-highlight/60 bg-highlight-soft/40 text-[0.65rem] font-semibold text-foreground tabular-nums"
            >
              {allergenNumber(allergen)}
            </span>
          ))}
        </span>
      </TooltipTrigger>
      <TooltipContent>{names}</TooltipContent>
    </Tooltip>
  );
}

/** "420 kcal · B 22 g · T 18 g · W 40 g" — only the figures that are set. */
export function MacroLine({
  kcal,
  proteinG,
  fatG,
  carbsG,
  className,
}: {
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  className?: string;
}) {
  const t = useTranslations('menuPage');
  const parts = [
    kcal !== null ? t('figures.kcal', { value: kcal }) : null,
    proteinG !== null ? t('figures.protein', { value: proteinG }) : null,
    fatG !== null ? t('figures.fat', { value: fatG }) : null,
    carbsG !== null ? t('figures.carbs', { value: carbsG }) : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;

  return (
    <span className={cn('text-xs text-muted-foreground tabular-nums', className)}>
      {parts.join(' · ')}
    </span>
  );
}
