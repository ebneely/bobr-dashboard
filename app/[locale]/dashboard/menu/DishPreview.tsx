'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { Allergen, MenuCourse } from '@/lib/api/menu';
import type { MealType } from '@/lib/api/orders';

import { AllergenMarks, COURSE_ICON, MacroLine, MUTED_LABEL } from './menu-shared';

export interface DishPreviewData {
  course: MenuCourse;
  name: string;
  description: string;
  diet: MealType | null;
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  allergens: readonly Allergen[];
  tags: readonly string[];
  imageUrl: string | null;
  isActive: boolean;
}

/**
 * The dish as a customer meets it on the storefront's menu page: photo, course
 * eyebrow, name, one line of description, quiet figures, allergen marks and a
 * diet badge. Built from shadcn parts, so it is a likeness rather than the
 * storefront's own component — close enough to catch a name that wraps badly
 * or a description that is really three paragraphs.
 */
export function DishPreview({ dish }: { dish: DishPreviewData }) {
  const t = useTranslations('menuPage');
  const Icon = COURSE_ICON[dish.course];

  return (
    <div
      className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
      data-testid="dish-preview"
    >
      {dish.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dish.imageUrl}
          alt=""
          className="aspect-4/3 w-full max-w-full object-cover"
        />
      ) : (
        <div className="flex aspect-4/3 w-full items-center justify-center bg-secondary">
          <Icon className="size-10 text-muted-foreground/60" aria-hidden />
        </div>
      )}

      <div className="flex flex-col gap-2 p-4">
        <span className={MUTED_LABEL}>{t(`courses.${dish.course}`)}</span>
        <strong className="text-lg leading-snug font-semibold text-foreground wrap-anywhere">
          {dish.name.trim() || t('preview.namePlaceholder')}
        </strong>
        {dish.description.trim() ? (
          <p className="line-clamp-2 text-sm text-muted-foreground wrap-anywhere">
            {dish.description}
          </p>
        ) : null}
        <MacroLine
          kcal={dish.kcal}
          proteinG={dish.proteinG}
          fatG={dish.fatG}
          carbsG={dish.carbsG}
        />
        {dish.diet || dish.allergens.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {dish.diet ? (
              <Badge variant="secondary">{t(`diets.${dish.diet}`)}</Badge>
            ) : (
              <span />
            )}
            <AllergenMarks allergens={dish.allergens} />
          </div>
        ) : null}
        {dish.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {dish.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {!dish.isActive ? (
        <p className="border-t bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
          {t('preview.hidden')}
        </p>
      ) : null}
    </div>
  );
}
