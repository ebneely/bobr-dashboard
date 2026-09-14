'use client';

import { useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  SaladIcon,
  Trash2Icon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import {
  groupByCourse,
  reorderWithinCourse,
  type AdminMenuItem,
  type MenuCourse,
} from '@/lib/api/menu';
import { cn } from '@/lib/cn';
import {
  useAdminMealsForMenu,
  useAdminMenuItems,
  useDeleteMenuItem,
  usePublicMenu,
  useReorderMenuItems,
} from '@/lib/hooks/use-menu';

import { DishDialog, type DishDialogState } from './DishDialog';
import { MenuDocumentCard } from './MenuDocumentCard';
import { AllergenMarks, COURSE_ICON, describeError, MacroLine } from './menu-shared';

/**
 * The Menu admin page: the printed menu on top, then the dishes as a day of
 * eating — Śniadanie down to Kolacja, each course its own card on a timeline —
 * rather than one flat table, because that is how the storefront reads it.
 */
export function MenuAdminClient() {
  const t = useTranslations('menuPage');
  const locale = useLocale();
  const translateApiError = useApiErrorTranslate();

  const items = useAdminMenuItems();
  const publicMenu = usePublicMenu(locale);
  const meals = useAdminMealsForMenu();
  const reorder = useReorderMenuItems();
  const remove = useDeleteMenuItem();

  const [dialog, setDialog] = useState<DishDialogState>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminMenuItem | null>(null);

  const list = items.data ?? [];
  const groups = groupByCourse(list);
  const activeCount = list.filter((item) => item.isActive).length;
  const nameOf = (item: AdminMenuItem) => (locale === 'en' ? item.nameEn : item.namePl);
  const dietOf = (item: AdminMenuItem) =>
    item.diet ?? meals.data?.find((meal) => meal.id === item.mealId)?.type ?? null;

  function move(item: AdminMenuItem, direction: 'up' | 'down') {
    const updates = reorderWithinCourse(list, item.id, direction);
    if (updates.length === 0) return;
    reorder.mutate(updates, {
      onError: (error) =>
        toast.error(describeError(error, t('errors.reorderFailed'), translateApiError)),
    });
  }

  async function doDelete(item: AdminMenuItem) {
    try {
      await remove.mutateAsync(item.id);
      toast.success(t('toast.deleted', { name: nameOf(item) }));
    } catch (error) {
      toast.error(describeError(error, t('errors.deleteFailed'), translateApiError));
    }
  }

  const documentError = publicMenu.isError
    ? describeError(publicMenu.error, t('errors.documentLoadFailed'), translateApiError)
    : null;

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col gap-8">
        <MenuDocumentCard
          document={publicMenu.data?.document ?? null}
          loading={publicMenu.isPending}
          loadError={documentError}
        />

        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="menu-dishes-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 id="menu-dishes-heading" className="text-xl font-semibold tracking-tight">
                {t('dishes.title')}
              </h2>
              <p className="text-sm text-muted-foreground" data-testid="dish-summary">
                {items.isSuccess && list.length > 0
                  ? t('dishes.summary', { count: list.length, active: activeCount })
                  : t('dishes.subtitle')}
              </p>
            </div>
            {items.isSuccess && list.length > 0 ? (
              <Button
                onClick={() => setDialog({ mode: 'create', course: 'BREAKFAST' })}
                data-testid="dish-new"
              >
                <PlusIcon />
                {t('actions.add')}
              </Button>
            ) : null}
          </div>

          {items.isPending ? (
            <ol className="flex flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
              {[0, 1, 2].map((key) => (
                <li key={key} className="flex gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-full bg-accent" />
                  <Skeleton className="h-32 flex-1 rounded-xl bg-accent" />
                </li>
              ))}
            </ol>
          ) : items.isError ? (
            <Alert variant="destructive" data-testid="dishes-error">
              <AlertTitle>{t('errors.loadFailedTitle')}</AlertTitle>
              <AlertDescription className="whitespace-pre-line">
                {describeError(items.error, t('errors.loadFailed'), translateApiError)}
              </AlertDescription>
              <AlertAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void items.refetch()}
                  disabled={items.isFetching}
                >
                  {t('actions.retry')}
                </Button>
              </AlertAction>
            </Alert>
          ) : list.length === 0 ? (
            <Card data-testid="dishes-empty">
              <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
                  <SaladIcon className="size-7" aria-hidden />
                </span>
                <div className="flex max-w-md flex-col gap-1">
                  <p className="text-lg font-semibold text-foreground">{t('dishes.emptyTitle')}</p>
                  <p className="text-muted-foreground">{t('dishes.emptyHint')}</p>
                </div>
                <div
                  className="flex flex-wrap justify-center gap-1.5 text-xs text-muted-foreground"
                  aria-hidden
                >
                  {groups.map(({ course }, index) => (
                    <span key={course} className="flex items-center gap-1.5">
                      {index > 0 ? <span>→</span> : null}
                      {t(`courses.${course}`)}
                    </span>
                  ))}
                </div>
                <Button
                  onClick={() => setDialog({ mode: 'create', course: 'BREAKFAST' })}
                  data-testid="dish-new-empty"
                >
                  <PlusIcon />
                  {t('actions.addFirst')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ol className="flex flex-col" data-testid="course-list">
              {groups.map(({ course, items: dishes }, index) => (
                <CourseSection
                  key={course}
                  course={course}
                  dishes={dishes}
                  last={index === groups.length - 1}
                  busy={reorder.isPending}
                  nameOf={nameOf}
                  dietOf={dietOf}
                  onAdd={() => setDialog({ mode: 'create', course })}
                  onEdit={(item) => setDialog({ mode: 'edit', item })}
                  onDelete={setConfirmDelete}
                  onMove={move}
                />
              ))}
            </ol>
          )}
        </section>
      </div>

      <DishDialog
        state={dialog}
        items={list}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('delete.title', { name: confirmDelete ? nameOf(confirmDelete) : '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('delete.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="dish-delete-confirm"
              onClick={() => {
                if (confirmDelete) void doDelete(confirmDelete);
              }}
            >
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}

function CourseSection({
  course,
  dishes,
  last,
  busy,
  nameOf,
  dietOf,
  onAdd,
  onEdit,
  onDelete,
  onMove,
}: {
  course: MenuCourse;
  dishes: AdminMenuItem[];
  last: boolean;
  busy: boolean;
  nameOf: (item: AdminMenuItem) => string;
  dietOf: (item: AdminMenuItem) => AdminMenuItem['diet'];
  onAdd: () => void;
  onEdit: (item: AdminMenuItem) => void;
  onDelete: (item: AdminMenuItem) => void;
  onMove: (item: AdminMenuItem, direction: 'up' | 'down') => void;
}) {
  const t = useTranslations('menuPage');
  const locale = useLocale();
  const Icon = COURSE_ICON[course];
  const headingId = `course-${course}`;

  return (
    <li
      className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3"
      data-testid="course-section"
      data-course={course}
    >
      {/* The timeline rail: a marker per course, a line down to the next. */}
      <div className="flex flex-col items-center" aria-hidden>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full ring-1',
            dishes.length > 0
              ? 'bg-primary text-primary-foreground ring-primary'
              : 'bg-card text-muted-foreground ring-foreground/15',
          )}
        >
          <Icon className="size-4" />
        </span>
        {!last ? <span className="w-px flex-1 bg-border" /> : null}
      </div>

      <section aria-labelledby={headingId} className={cn('min-w-0', !last && 'pb-6')}>
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          <h3 id={headingId} className="flex items-baseline gap-2 text-base font-semibold">
            {t(`courses.${course}`)}
            <span className="text-sm font-normal text-muted-foreground">
              {t('dishes.count', { count: dishes.length })}
            </span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAdd}
            data-testid={`dish-add-${course}`}
          >
            <PlusIcon />
            {t('actions.addTo', { course: t(`courses.${course}`) })}
          </Button>
        </div>

        {dishes.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
            {t('dishes.courseEmpty')}
          </p>
        ) : (
          <Card className="mt-2 gap-0 py-0">
            <ul className="divide-y">
              {dishes.map((item, index) => {
                const diet = dietOf(item);
                const otherName = locale === 'en' ? item.namePl : item.nameEn;
                return (
                  <li
                    key={item.id}
                    className={cn(
                      'flex flex-col gap-3 p-3 sm:flex-row sm:items-center',
                      !item.isActive && 'bg-muted/40',
                    )}
                    data-testid="dish-row"
                    data-dish-id={item.id}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className={cn(
                            'size-14 shrink-0 rounded-md object-cover ring-1 ring-foreground/10',
                            !item.isActive && 'opacity-60 grayscale',
                          )}
                        />
                      ) : (
                        <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-secondary">
                          <Icon className="size-5 text-muted-foreground/70" aria-hidden />
                        </span>
                      )}
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <strong
                            className={cn(
                              'font-semibold wrap-anywhere text-foreground',
                              !item.isActive && 'text-muted-foreground',
                            )}
                            data-testid="dish-name"
                          >
                            {nameOf(item)}
                          </strong>
                          {diet ? <Badge variant="secondary">{t(`diets.${diet}`)}</Badge> : null}
                          {!item.isActive ? (
                            <Badge variant="outline" data-testid="dish-hidden">
                              <EyeOffIcon />
                              {t('dishes.hidden')}
                            </Badge>
                          ) : null}
                        </div>
                        {otherName ? (
                          <span className="text-xs text-muted-foreground wrap-anywhere">
                            {otherName}
                          </span>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <MacroLine
                            kcal={item.kcal}
                            proteinG={item.proteinG}
                            fatG={item.fatG}
                            carbsG={item.carbsG}
                          />
                          <AllergenMarks allergens={item.allergens} />
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onMove(item, 'up')}
                        disabled={busy || index === 0}
                        aria-label={t('actions.moveUp', { name: nameOf(item) })}
                        data-testid="dish-up"
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onMove(item, 'down')}
                        disabled={busy || index === dishes.length - 1}
                        aria-label={t('actions.moveDown', { name: nameOf(item) })}
                        data-testid="dish-down"
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(item)}
                        className="ml-1"
                        data-testid="dish-edit"
                      >
                        <PencilIcon />
                        {t('actions.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(item)}
                        aria-label={t('actions.deleteNamed', { name: nameOf(item) })}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        data-testid="dish-delete"
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </li>
  );
}
