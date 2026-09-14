'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { ImageUpIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import {
  ALLERGENS,
  MAX_UPLOAD_BYTES,
  MENU_COURSES,
  PHOTO_ACCEPT,
  nextSortOrder,
  parseTags,
  parseWholeNumber,
  type AdminMenuItem,
  type Allergen,
  type MenuCourse,
} from '@/lib/api/menu';
import { useAdminMealsForMenu, useSaveMenuItem } from '@/lib/hooks/use-menu';

import { DishPreview } from './DishPreview';
import { allergenNumber, COURSE_ICON, describeError, MUTED_LABEL } from './menu-shared';

/** Nothing open, a new dish (optionally in a given course), or one dish. */
export type DishDialogState =
  | { mode: 'create'; course: MenuCourse }
  | { mode: 'edit'; item: AdminMenuItem }
  | null;

export function DishDialog({
  state,
  items,
  onOpenChange,
}: {
  state: DishDialogState;
  items: readonly AdminMenuItem[];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        {state ? (
          <DishForm
            // Keyed so each opening starts from that dish's values.
            key={state.mode === 'edit' ? state.item.id : `new-${state.course}`}
            item={state.mode === 'edit' ? state.item : null}
            initialCourse={state.mode === 'create' ? state.course : state.item.course}
            items={items}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const NUMBER_FIELDS = ['kcal', 'proteinG', 'fatG', 'carbsG'] as const;
type NumberField = (typeof NUMBER_FIELDS)[number];
const NO_DIET = 'none';

function toText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function DishForm({
  item,
  initialCourse,
  items,
  onDone,
}: {
  item: AdminMenuItem | null;
  initialCourse: MenuCourse;
  items: readonly AdminMenuItem[];
  onDone: () => void;
}) {
  const t = useTranslations('menuPage');
  const locale = useLocale();
  const translateApiError = useApiErrorTranslate();
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;

  const meals = useAdminMealsForMenu();
  const save = useSaveMenuItem();

  const [course, setCourse] = useState<MenuCourse>(initialCourse);
  const [mealId, setMealId] = useState<string>(item?.mealId ?? NO_DIET);
  const [namePl, setNamePl] = useState(item?.namePl ?? '');
  const [nameEn, setNameEn] = useState(item?.nameEn ?? '');
  const [descriptionPl, setDescriptionPl] = useState(item?.descriptionPl ?? '');
  const [descriptionEn, setDescriptionEn] = useState(item?.descriptionEn ?? '');
  const [numbers, setNumbers] = useState<Record<NumberField, string>>({
    kcal: toText(item?.kcal),
    proteinG: toText(item?.proteinG),
    fatG: toText(item?.fatG),
    carbsG: toText(item?.carbsG),
  });
  const [allergens, setAllergens] = useState<Allergen[]>(item?.allergens ?? []);
  const [tagText, setTagText] = useState(item?.tags.join(', ') ?? '');
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [previewLocale, setPreviewLocale] = useState(locale === 'en' ? 'en' : 'pl');
  const [error, setError] = useState<string | null>(null);
  const [showInvalid, setShowInvalid] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  // The object URL of a chosen photo is revoked when it is replaced (in the
  // change handler) and when the dialog closes (here).
  const photoUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    },
    [],
  );

  const parsed = Object.fromEntries(
    NUMBER_FIELDS.map((field) => [field, parseWholeNumber(numbers[field])]),
  ) as Record<NumberField, number | null | undefined>;
  const tags = parseTags(tagText);
  const linkedMeal = meals.data?.find((meal) => meal.id === mealId) ?? null;
  const diet = linkedMeal?.type ?? (mealId === item?.mealId ? (item?.diet ?? null) : null);

  const nameMissing = { pl: namePl.trim() === '', en: nameEn.trim() === '' };

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('errors.fileTooLarge'));
      return;
    }
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    const url = URL.createObjectURL(file);
    photoUrl.current = url;
    setPhoto({ file, url });
    setError(null);
  }

  async function submit() {
    setError(null);
    setShowInvalid(true);

    if (nameMissing.pl || nameMissing.en) {
      setError(t('errors.nameRequired'));
      return;
    }
    if (NUMBER_FIELDS.some((field) => parsed[field] === undefined)) {
      setError(t('errors.wholeNumbers'));
      return;
    }

    // A dish moved to another course goes to the end of that course.
    const sortOrder =
      item && item.course === course ? item.sortOrder : nextSortOrder(items, course);

    try {
      const { photoError } = await save.mutateAsync({
        id: item?.id ?? null,
        photo: photo?.file ?? null,
        input: {
          course,
          namePl: namePl.trim(),
          nameEn: nameEn.trim(),
          descriptionPl: descriptionPl.trim() || null,
          descriptionEn: descriptionEn.trim() || null,
          mealId: mealId === NO_DIET ? null : mealId,
          kcal: parsed.kcal ?? null,
          proteinG: parsed.proteinG ?? null,
          fatG: parsed.fatG ?? null,
          carbsG: parsed.carbsG ?? null,
          allergens: [...allergens].sort((a, b) => allergenNumber(a) - allergenNumber(b)),
          tags,
          sortOrder,
          isActive,
        },
      });
      const name = locale === 'en' ? nameEn.trim() : namePl.trim();
      toast.success(item ? t('toast.saved', { name }) : t('toast.created', { name }));
      if (photoError) {
        toast.error(describeError(photoError, t('errors.photoFailed'), translateApiError));
      }
      onDone();
    } catch (caught) {
      // 422s land here, inside the dialog, so nothing typed is lost.
      setError(describeError(caught, t('errors.saveFailed'), translateApiError));
    }
  }

  const twoColumns = 'grid gap-4 sm:grid-cols-2';
  const imageUrl = photo?.url ?? item?.imageUrl ?? null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg">
          {item ? t('dialog.editTitle') : t('dialog.createTitle')}
        </DialogTitle>
        <DialogDescription>{t('dialog.description')}</DialogDescription>
      </DialogHeader>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col gap-6" data-testid="dish-form">
          <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
            <legend className={`${MUTED_LABEL} mb-3`}>{t('dialog.sections.basics')}</legend>
            <div className="grid min-w-0 content-start gap-1.5">
              <Label htmlFor={id('course')}>{t('fields.course')}</Label>
              <Select value={course} onValueChange={(value) => setCourse(value as MenuCourse)}>
                <SelectTrigger id={id('course')} className="w-full" data-testid="dish-course">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MENU_COURSES.map((value) => {
                    const Icon = COURSE_ICON[value];
                    return (
                      <SelectItem key={value} value={value}>
                        <Icon aria-hidden />
                        {t(`courses.${value}`)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 content-start gap-1.5">
              <Label htmlFor={id('diet')}>{t('fields.diet')}</Label>
              <Select value={mealId} onValueChange={setMealId} disabled={meals.isError}>
                <SelectTrigger id={id('diet')} className="w-full" data-testid="dish-diet">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DIET}>{t('fields.noDiet')}</SelectItem>
                  {(meals.data ?? []).map((meal) => (
                    <SelectItem key={meal.id} value={meal.id}>
                      {locale === 'en' ? meal.nameEn : meal.namePl}
                      <span className="text-muted-foreground">· {t(`diets.${meal.type}`)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {meals.isError ? t('fields.dietUnavailable') : t('fields.dietHint')}
              </p>
            </div>
          </fieldset>

          <fieldset className="grid min-w-0 gap-4">
            <legend className={`${MUTED_LABEL} mb-3`}>{t('dialog.sections.naming')}</legend>
            <div className={twoColumns}>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={id('namePl')}>{t('fields.namePl')}</Label>
                <Input
                  id={id('namePl')}
                  value={namePl}
                  onChange={(e) => setNamePl(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  aria-invalid={(showInvalid && nameMissing.pl) || undefined}
                  data-testid="dish-name-pl"
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={id('nameEn')}>{t('fields.nameEn')}</Label>
                <Input
                  id={id('nameEn')}
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  aria-invalid={(showInvalid && nameMissing.en) || undefined}
                  data-testid="dish-name-en"
                />
              </div>
            </div>
            <div className={twoColumns}>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={id('descriptionPl')}>{t('fields.descriptionPl')}</Label>
                <Textarea
                  id={id('descriptionPl')}
                  value={descriptionPl}
                  onChange={(e) => setDescriptionPl(e.target.value)}
                  rows={2}
                  maxLength={500}
                  data-testid="dish-description-pl"
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={id('descriptionEn')}>{t('fields.descriptionEn')}</Label>
                <Textarea
                  id={id('descriptionEn')}
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  rows={2}
                  maxLength={500}
                  data-testid="dish-description-en"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="grid min-w-0 gap-3">
            <legend className={`${MUTED_LABEL} mb-3`}>{t('dialog.sections.nutrition')}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {NUMBER_FIELDS.map((field) => (
                <div key={field} className="grid min-w-0 gap-1.5">
                  <Label htmlFor={id(field)}>{t(`fields.${field}`)}</Label>
                  <div className="relative">
                    <Input
                      id={id(field)}
                      // text + numeric keypad rather than type=number: a number
                      // input accepts "12.5" and "1e3", and these are integers.
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={numbers[field]}
                      onChange={(e) =>
                        setNumbers((current) => ({
                          ...current,
                          // Digits only, as typed or pasted — a decimal cannot get in.
                          [field]: e.target.value.replace(/\D/g, '').slice(0, 5),
                        }))
                      }
                      className="pr-10 tabular-nums"
                      aria-invalid={parsed[field] === undefined || undefined}
                      data-testid={`dish-${field}`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                      {field === 'kcal' ? 'kcal' : 'g'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('fields.nutritionHint')}</p>
          </fieldset>

          <fieldset className="grid min-w-0 gap-3">
            <legend className={`${MUTED_LABEL} mb-3`}>
              {t('dialog.sections.allergens')}
              {allergens.length > 0 ? (
                <span className="ml-2 normal-case tracking-normal">
                  {t('fields.allergensSelected', { count: allergens.length })}
                </span>
              ) : null}
            </legend>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              value={allergens}
              onValueChange={(value) => setAllergens(value as Allergen[])}
              aria-label={t('dialog.sections.allergens')}
              className="w-full"
              data-testid="dish-allergens"
            >
              {ALLERGENS.map((allergen) => (
                <ToggleGroupItem
                  key={allergen}
                  value={allergen}
                  className="gap-1.5 font-normal"
                  data-testid={`allergen-${allergen}`}
                >
                  <span className="text-[0.7rem] font-semibold opacity-70 tabular-nums">
                    {allergenNumber(allergen)}
                  </span>
                  {t(`allergens.${allergen}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">{t('fields.allergensHint')}</p>
          </fieldset>

          <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
            <legend className={`${MUTED_LABEL} mb-3`}>{t('dialog.sections.more')}</legend>
            <div className="grid min-w-0 content-start gap-1.5">
              <Label htmlFor={id('tags')}>{t('fields.tags')}</Label>
              <Input
                id={id('tags')}
                value={tagText}
                onChange={(e) => setTagText(e.target.value)}
                placeholder={t('fields.tagsPlaceholder')}
                autoComplete="off"
                data-testid="dish-tags"
              />
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-normal">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('fields.tagsHint')}</p>
              )}
            </div>

            <div className="grid min-w-0 content-start gap-1.5">
              <span className="text-sm leading-none font-medium">{t('fields.photo')}</span>
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt=""
                    className="size-14 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
                  />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed bg-secondary">
                    <ImageUpIcon className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInput.current?.click()}
                    data-testid="dish-photo-choose"
                  >
                    {imageUrl ? t('fields.photoReplace') : t('fields.photoChoose')}
                  </Button>
                  <span className="truncate text-xs text-muted-foreground">
                    {photo ? photo.file.name : t('fields.photoHint')}
                  </span>
                </div>
              </div>
              <Input
                ref={fileInput}
                type="file"
                accept={PHOTO_ACCEPT}
                className="hidden"
                tabIndex={-1}
                aria-hidden
                onChange={choosePhoto}
                data-testid="dish-photo-input"
              />
            </div>

            <div className="flex items-start gap-3 sm:col-span-2">
              <Switch
                id={id('active')}
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="dish-active"
              />
              <div className="grid gap-1">
                <Label htmlFor={id('active')}>{t('fields.isActive')}</Label>
                <p className="text-xs text-muted-foreground">{t('fields.isActiveHint')}</p>
              </div>
            </div>
          </fieldset>
        </div>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
          <div className="flex items-center justify-between gap-2">
            <span className={MUTED_LABEL}>{t('preview.title')}</span>
            <Tabs value={previewLocale} onValueChange={setPreviewLocale}>
              <TabsList aria-label={t('preview.language')}>
                <TabsTrigger value="pl">PL</TabsTrigger>
                <TabsTrigger value="en">EN</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <DishPreview
            dish={{
              course,
              name: previewLocale === 'en' ? nameEn : namePl,
              description: previewLocale === 'en' ? descriptionEn : descriptionPl,
              diet,
              kcal: parsed.kcal ?? null,
              proteinG: parsed.proteinG ?? null,
              fatG: parsed.fatG ?? null,
              carbsG: parsed.carbsG ?? null,
              allergens,
              tags,
              imageUrl,
              isActive,
            }}
          />
          <p className="text-xs text-muted-foreground">{t('preview.note')}</p>
        </aside>
      </div>

      {error ? (
        <Alert variant="destructive" data-testid="dish-error">
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          {t('actions.cancel')}
        </Button>
        <Button
          onClick={() => void submit()}
          disabled={save.isPending}
          data-testid="dish-submit"
        >
          {save.isPending
            ? t('actions.saving')
            : item
              ? t('actions.save')
              : t('actions.create')}
        </Button>
      </DialogFooter>
    </>
  );
}
