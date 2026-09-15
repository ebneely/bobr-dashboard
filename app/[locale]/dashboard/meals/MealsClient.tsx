'use client';

import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Form } from 'radix-ui';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ApiError, formatApiError, type ApiErrorTranslate } from '@/lib/api/client';
import { ALLERGENS, parseWholeNumber, type Allergen } from '@/lib/api/menu';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import {
  apiAdminCreateMeal,
  apiAdminDeactivateMeal,
  apiAdminListMeals,
  apiAdminUpdateMeal,
  apiAdminUploadMealImage,
  formatGrosze,
  groszeToZloteInput,
  zloteToGrosze,
  MEAL_TYPES,
  type AdminMeal,
  type MealType,
} from '@/lib/api/orders';
import { cn } from '@/lib/cn';

/**
 * Turns whatever was thrown into one line a person can act on.
 *
 * The backend answers a failed validation with a `{field, issue}[]`, and
 * rendering that array into JSX throws React error #31 and blanks the page —
 * so it goes through formatApiError, which flattens all three message shapes.
 */
function describeError(
  error: unknown,
  fallback: string,
  translate: ApiErrorTranslate,
): string {
  if (error instanceof ApiError) return formatApiError(error.body, translate) || fallback;
  return fallback;
}

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-4';
const MUTED_LABEL = 'text-xs tracking-wider text-muted-foreground uppercase';

export function MealsClient() {
  const t = useTranslations('adminMeals');
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();

  const [meals, setMeals] = useState<AdminMeal[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** The meal being edited, the string 'new' while creating, or nothing open. */
  const [editing, setEditing] = useState<AdminMeal | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  /** The meal waiting on the deactivation confirmation, if any. */
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminMeal | null>(null);

  async function load() {
    try {
      setMeals(await apiAdminListMeals());
      setLoadError(null);
    } catch (error) {
      setMeals([]);
      setLoadError(describeError(error, t('loadFailed'), translateApiError));
    }
  }

  // The first load. State is set from the promise's callbacks and never in the
  // effect body — React 19 rejects a synchronous setState there, because it
  // renders twice for no reason. `alive` drops a response that arrives after
  // the screen has gone, which would otherwise set state on nothing.
  useEffect(() => {
    let alive = true;
    apiAdminListMeals()
      .then((rows) => {
        if (alive) {
          setMeals(rows);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setMeals([]);
          setLoadError(describeError(error, t('loadFailed'), translateApiError));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deactivate(meal: AdminMeal) {
    // It is a DELETE on the wire and a deactivation in effect: orders point at
    // meals, and an order must keep naming what was bought. The AlertDialog in
    // front of this call says so first.
    setBusyId(meal.id);
    setRowError(null);
    try {
      await apiAdminDeactivateMeal(meal.id);
      await load();
    } catch (error) {
      setRowError(describeError(error, t('deactivateFailed'), translateApiError));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button
          type="button"
          size="lg"
          onClick={() => setEditing(editing === 'new' ? null : 'new')}
          data-testid="new-meal"
        >
          {t('new')}
        </Button>
      </div>

      {editing !== null && (
        <MealForm
          // Keyed so switching between meals remounts the form rather than
          // leaving the previous meal's values sitting in the fields.
          key={editing === 'new' ? 'new' : editing.id}
          meal={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {loadError && <ErrorAlert message={loadError} />}
      {rowError && <ErrorAlert message={rowError} />}

      {meals === null ? (
        <div className={GRID} aria-label={t('loading')}>
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : meals.length === 0 && !loadError ? (
        <p className="text-muted-foreground">{t('none')}</p>
      ) : (
        // min(260px, 100%) so a narrow phone gets one column instead of a track
        // wider than the screen — the usual source of a sideways scroll.
        <ul className={GRID} data-testid="meal-list">
          {meals.map((meal) => (
            <li key={meal.id} className="min-w-0">
              <Card className="h-full">
                <CardContent className="flex flex-col gap-3">
                  <MealThumbnail meal={meal} label={t('noPhoto')} />

                  <div className="flex flex-col gap-1.5">
                    <span className={MUTED_LABEL}>{t(`types.${meal.type}`)}</span>
                    <strong className="text-lg wrap-anywhere">
                      {locale === 'pl' ? meal.namePl : meal.nameEn}
                    </strong>
                    <span className="text-muted-foreground wrap-anywhere">
                      {(locale === 'pl' ? meal.descriptionPl : meal.descriptionEn) ?? ''}
                    </span>
                    {/* Grosze become a decimal here and nowhere earlier. */}
                    <span className="text-xl font-semibold">
                      {formatGrosze(meal.priceGrosze, locale)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'tracking-wider uppercase',
                        meal.isActive
                          ? 'border-primary text-primary'
                          : 'text-muted-foreground',
                      )}
                    >
                      {meal.isActive ? t('active') : t('inactive')}
                    </Badge>
                    {meal.kcal != null && (
                      <span className="text-xs text-muted-foreground">
                        {meal.kcal} kcal
                      </span>
                    )}
                    {meal.allergens.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {meal.allergens.map((a) => (
                          <Badge key={a} variant="outline" className="text-xs">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="mt-auto flex-wrap gap-2 border-t-0 bg-transparent pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(meal)}
                  >
                    {t('edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmDeactivate(meal)}
                    disabled={!meal.isActive || busyId === meal.id}
                    data-testid="deactivate-meal"
                  >
                    {busyId === meal.id ? t('deactivating') : t('deactivate')}
                  </Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={confirmDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeactivate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deactivate')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deactivateConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="confirm-deactivate"
              onClick={() => {
                if (confirmDeactivate) void deactivate(confirmDeactivate);
              }}
            >
              {t('deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="whitespace-pre-line">{message}</AlertDescription>
    </Alert>
  );
}

/**
 * The picture, or an honest empty frame.
 *
 * `imageUrl` is absent from the list endpoint and null whenever no bucket is
 * configured, which is the normal state locally. An <img> pointed at nothing
 * draws a broken-image glyph and reads as a fault in the meal; a placeholder
 * reads as what it is — no photograph yet.
 */
function MealThumbnail({ meal, label }: { meal: AdminMeal; label: string }) {
  if (meal.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={meal.imageUrl}
        alt={meal.namePl}
        className="aspect-4/3 w-full max-w-full rounded-md object-cover"
      />
    );
  }

  return (
    <div
      className="flex aspect-4/3 w-full items-center justify-center rounded-md border border-dashed bg-secondary"
      data-testid="meal-image-placeholder"
      role="img"
      aria-label={label}
    >
      <span className={MUTED_LABEL}>{label}</span>
    </div>
  );
}

/**
 * Create and edit are one form.
 *
 * The fields and the validation are identical; only the request differs. Two
 * components would mean two places for the złote→grosze conversion to drift.
 */
function MealForm({
  meal,
  onCancel,
  onSaved,
}: {
  meal: AdminMeal | null;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTranslations('adminMeals');
  // Allergen names are shared with the menu's dish dialog — the same EU-14
  // list, worded once under menuPage.allergens.
  const ta = useTranslations('menuPage');
  const translateApiError = useApiErrorTranslate();
  const fieldId = useId();

  const [type, setType] = useState<MealType>(meal?.type ?? 'KETOGENIC');
  const [namePl, setNamePl] = useState(meal?.namePl ?? '');
  const [nameEn, setNameEn] = useState(meal?.nameEn ?? '');
  const [descriptionPl, setDescriptionPl] = useState(meal?.descriptionPl ?? '');
  const [descriptionEn, setDescriptionEn] = useState(meal?.descriptionEn ?? '');
  // Złote in the field, grosze on the wire. Converted once, on submit.
  const [price, setPrice] = useState(
    meal ? groszeToZloteInput(meal.priceGrosze) : '',
  );
  const [allergens, setAllergens] = useState<Allergen[]>(meal?.allergens ?? []);
  const [kcalText, setKcalText] = useState(meal?.kcal != null ? String(meal.kcal) : '');
  const [isActive, setIsActive] = useState(meal?.isActive ?? true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<AdminMeal | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!namePl.trim() || !nameEn.trim()) {
      setError(t('nameRequired'));
      return;
    }

    const priceGrosze = zloteToGrosze(price);
    if (priceGrosze === null) {
      setError(t('priceInvalid'));
      return;
    }

    const kcal = parseWholeNumber(kcalText);
    if (kcal === undefined) {
      setError(t('kcalInvalid'));
      return;
    }

    setBusy(true);
    try {
      const input = {
        type,
        namePl: namePl.trim(),
        nameEn: nameEn.trim(),
        descriptionPl: descriptionPl.trim() || null,
        descriptionEn: descriptionEn.trim() || null,
        priceGrosze,
        isActive,
        allergens,
        kcal,
      };
      if (meal) await apiAdminUpdateMeal(meal.id, input);
      else await apiAdminCreateMeal(input);
      await onSaved();
    } catch (err) {
      setError(describeError(err, t('saveFailed'), translateApiError));
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !meal) return;
    setUploading(true);
    setUploadError(null);
    try {
      setUploaded(await apiAdminUploadMealImage(meal.id, file));
    } catch (err) {
      // Garage and imgproxy live in Dokploy, not in the local compose file, so
      // a failure here is the expected local outcome. Say so rather than
      // pretending the upload worked.
      setUploadError(describeError(err, t('uploadFailed'), translateApiError));
    } finally {
      setUploading(false);
      // Let the same file be chosen again after a failure.
      event.target.value = '';
    }
  }

  const id = (field: string) => `${fieldId}-${field}`;
  const twoColumns =
    'grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4';

  return (
    <Card>
      {/* Radix's Form primitive renders a real HTML form element, so Enter still
          submits and the submit button is still a submit button. */}
      <Form.Root
        onSubmit={submit}
        data-testid="meal-form"
        className="flex min-w-0 flex-col gap-4"
      >
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {meal ? t('editTitle') : t('createTitle')}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={id('type')}>{t('type')}</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as MealType)}
              name="type"
            >
              <SelectTrigger id={id('type')} className="w-full" data-testid="meal-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`types.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={twoColumns}>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor={id('namePl')}>{t('namePl')}</Label>
              <Input
                id={id('namePl')}
                value={namePl}
                onChange={(e) => setNamePl(e.target.value)}
                maxLength={120}
                name="namePl"
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor={id('nameEn')}>{t('nameEn')}</Label>
              <Input
                id={id('nameEn')}
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                maxLength={120}
                name="nameEn"
              />
            </div>
          </div>

          <div className={twoColumns}>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor={id('descriptionPl')}>{t('descriptionPl')}</Label>
              <Textarea
                id={id('descriptionPl')}
                value={descriptionPl}
                onChange={(e) => setDescriptionPl(e.target.value)}
                rows={2}
                maxLength={1000}
                name="descriptionPl"
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor={id('descriptionEn')}>{t('descriptionEn')}</Label>
              <Textarea
                id={id('descriptionEn')}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                rows={2}
                maxLength={1000}
                name="descriptionEn"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={id('price')}>{t('price')}</Label>
            <Input
              id={id('price')}
              // text + inputMode rather than type=number: the Polish decimal
              // separator is a comma, which a number input silently discards.
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="45,00"
              name="price"
              aria-describedby={id('priceHint')}
            />
            <p id={id('priceHint')} className="text-xs text-muted-foreground">
              {t('priceHint')}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={id('kcal')}>{t('kcal')}</Label>
            <Input
              id={id('kcal')}
              type="text"
              inputMode="numeric"
              value={kcalText}
              onChange={(e) => setKcalText(e.target.value)}
              placeholder="450"
              className="w-32"
              name="kcal"
            />
          </div>

          <fieldset className="grid min-w-0 gap-3">
            <legend className={cn(MUTED_LABEL, 'mb-1.5')}>{t('allergens')}</legend>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              value={allergens}
              onValueChange={(value) => setAllergens(value as Allergen[])}
              aria-label={t('allergens')}
              className="w-full"
              data-testid="meal-allergens"
            >
              {ALLERGENS.map((allergen) => (
                <ToggleGroupItem
                  key={allergen}
                  value={allergen}
                  className="gap-1.5 font-normal"
                  data-testid={`meal-allergen-${allergen}`}
                >
                  <span className="text-[0.7rem] font-semibold opacity-70 tabular-nums">
                    {ALLERGENS.indexOf(allergen) + 1}
                  </span>
                  {ta(`allergens.${allergen}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>

          <Label htmlFor={id('isActive')} className="font-normal">
            <Checkbox
              id={id('isActive')}
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
              name="isActive"
              data-testid="meal-isActive"
            />
            {t('isActive')}
          </Label>

          {meal && (
            <fieldset className="min-w-0 rounded-lg border p-3">
              <legend className={cn(MUTED_LABEL, 'px-1')}>{t('photo')}</legend>
              {/* Capped: a 4:3 frame across the full width of a desktop form is a
                  lot of empty grey for a picture that may not exist yet. */}
              <div className="max-w-80">
                <MealThumbnail meal={uploaded ?? meal} label={t('noPhoto')} />
              </div>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(e) => void upload(e)}
                disabled={uploading}
                aria-label={t('choosePhoto')}
                className="mt-3 h-auto max-w-full cursor-pointer py-1.5"
              />
              {uploading && (
                <p className="mt-2 text-sm text-muted-foreground">{t('uploading')}</p>
              )}
              {uploadError && (
                <div className="mt-2">
                  <ErrorAlert message={uploadError} />
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{t('uploadNote')}</p>
            </fieldset>
          )}

          {error && <ErrorAlert message={error} />}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" disabled={busy}>
              {busy
                ? meal
                  ? t('saving')
                  : t('creating')
                : meal
                  ? t('save')
                  : t('create')}
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={onCancel}>
              {t('cancel')}
            </Button>
          </div>
        </CardContent>
      </Form.Root>
    </Card>
  );
}
