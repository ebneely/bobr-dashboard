'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { ApiError, formatApiError } from '@/lib/api/client';
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

/**
 * Turns whatever was thrown into one line a person can act on.
 *
 * The backend answers a failed validation with a `{field, issue}[]`, and
 * rendering that array into JSX throws React error #31 and blanks the page —
 * so it goes through formatApiError, which flattens all three message shapes.
 */
function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return formatApiError(error.body) || fallback;
  return fallback;
}

export function MealsClient() {
  const t = useTranslations('adminMeals');
  const locale = useLocale();

  const [meals, setMeals] = useState<AdminMeal[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** The meal being edited, the string 'new' while creating, or nothing open. */
  const [editing, setEditing] = useState<AdminMeal | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function load() {
    try {
      setMeals(await apiAdminListMeals());
      setLoadError(null);
    } catch (error) {
      setMeals([]);
      setLoadError(describeError(error, t('loadFailed')));
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
          setLoadError(describeError(error, t('loadFailed')));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deactivate(meal: AdminMeal) {
    // It is a DELETE on the wire and a deactivation in effect: orders point at
    // meals, and an order must keep naming what was bought. Say so first.
    if (!window.confirm(t('deactivateConfirm'))) return;
    setBusyId(meal.id);
    setRowError(null);
    try {
      await apiAdminDeactivateMeal(meal.id);
      await load();
    } catch (error) {
      setRowError(describeError(error, t('deactivateFailed')));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <button
          type="button"
          onClick={() => setEditing(editing === 'new' ? null : 'new')}
          style={primaryButton}
          data-testid="new-meal"
        >
          {t('new')}
        </button>
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

      {loadError && (
        <p role="alert" style={errorText}>
          {loadError}
        </p>
      )}
      {rowError && (
        <p role="alert" style={errorText}>
          {rowError}
        </p>
      )}

      {meals === null ? (
        <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('loading')}</p>
      ) : meals.length === 0 && !loadError ? (
        <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('none')}</p>
      ) : (
        <ul style={gridStyle} data-testid="meal-list">
          {meals.map((meal) => (
            <li key={meal.id} style={cardStyle}>
              <MealThumbnail meal={meal} label={t('noPhoto')} />

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
              >
                <span style={mutedLabel}>{t(`types.${meal.type}`)}</span>
                <strong
                  style={{
                    fontSize: 'var(--bobr-text-lg)',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {locale === 'pl' ? meal.namePl : meal.nameEn}
                </strong>
                <span
                  style={{
                    overflowWrap: 'anywhere',
                    color: 'var(--bobr-fg-muted)',
                  }}
                >
                  {(locale === 'pl' ? meal.descriptionPl : meal.descriptionEn) ?? ''}
                </span>
                {/* Grosze become a decimal here and nowhere earlier. */}
                <span style={{ fontSize: 'var(--bobr-text-xl)', fontWeight: 600 }}>
                  {formatGrosze(meal.priceGrosze, locale)}
                </span>
                <span
                  style={{
                    ...badgeStyle,
                    color: meal.isActive
                      ? 'var(--bobr-accent-hover)'
                      : 'var(--bobr-fg-muted)',
                    borderColor: meal.isActive
                      ? 'var(--bobr-accent)'
                      : 'var(--bobr-border)',
                  }}
                >
                  {meal.isActive ? t('active') : t('inactive')}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditing(meal)}
                  style={secondaryButton}
                >
                  {t('edit')}
                </button>
                <button
                  type="button"
                  onClick={() => void deactivate(meal)}
                  disabled={!meal.isActive || busyId === meal.id}
                  style={{ ...secondaryButton, color: 'var(--bobr-danger)' }}
                >
                  {busyId === meal.id ? t('deactivating') : t('deactivate')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
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
        style={{
          width: '100%',
          maxWidth: '100%',
          aspectRatio: '4 / 3',
          objectFit: 'cover',
          borderRadius: 'var(--bobr-radius-sm)',
        }}
      />
    );
  }

  return (
    <div
      style={placeholderStyle}
      data-testid="meal-image-placeholder"
      role="img"
      aria-label={label}
    >
      <span style={mutedLabel}>{label}</span>
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

  const [type, setType] = useState<MealType>(meal?.type ?? 'KETOGENIC');
  const [namePl, setNamePl] = useState(meal?.namePl ?? '');
  const [nameEn, setNameEn] = useState(meal?.nameEn ?? '');
  const [descriptionPl, setDescriptionPl] = useState(meal?.descriptionPl ?? '');
  const [descriptionEn, setDescriptionEn] = useState(meal?.descriptionEn ?? '');
  // Złote in the field, grosze on the wire. Converted once, on submit.
  const [price, setPrice] = useState(
    meal ? groszeToZloteInput(meal.priceGrosze) : '',
  );
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
      };
      if (meal) await apiAdminUpdateMeal(meal.id, input);
      else await apiAdminCreateMeal(input);
      await onSaved();
    } catch (err) {
      setError(describeError(err, t('saveFailed')));
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
      setUploadError(describeError(err, t('uploadFailed')));
    } finally {
      setUploading(false);
      // Let the same file be chosen again after a failure.
      event.target.value = '';
    }
  }

  return (
    <form onSubmit={submit} style={formStyle} data-testid="meal-form">
      <h2
        style={{ fontSize: 'var(--bobr-text-lg)', fontWeight: 600, margin: 0 }}
      >
        {meal ? t('editTitle') : t('createTitle')}
      </h2>

      <label style={labelStyle}>
        {t('type')}
        <select
          value={type}
          onChange={(e) => setType(e.target.value as MealType)}
          style={fieldStyle}
          name="type"
        >
          {MEAL_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`types.${value}`)}
            </option>
          ))}
        </select>
      </label>

      <div style={twoColumns}>
        <label style={labelStyle}>
          {t('namePl')}
          <input
            value={namePl}
            onChange={(e) => setNamePl(e.target.value)}
            maxLength={120}
            style={fieldStyle}
            name="namePl"
          />
        </label>
        <label style={labelStyle}>
          {t('nameEn')}
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            maxLength={120}
            style={fieldStyle}
            name="nameEn"
          />
        </label>
      </div>

      <div style={twoColumns}>
        <label style={labelStyle}>
          {t('descriptionPl')}
          <textarea
            value={descriptionPl}
            onChange={(e) => setDescriptionPl(e.target.value)}
            rows={2}
            maxLength={1000}
            style={{ ...fieldStyle, resize: 'vertical' }}
            name="descriptionPl"
          />
        </label>
        <label style={labelStyle}>
          {t('descriptionEn')}
          <textarea
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            rows={2}
            maxLength={1000}
            style={{ ...fieldStyle, resize: 'vertical' }}
            name="descriptionEn"
          />
        </label>
      </div>

      <label style={labelStyle}>
        {t('price')}
        <input
          // text + inputMode rather than type=number: the Polish decimal
          // separator is a comma, which a number input silently discards.
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="45,00"
          style={fieldStyle}
          name="price"
        />
        <span style={{ ...mutedLabel, textTransform: 'none', letterSpacing: 0 }}>
          {t('priceHint')}
        </span>
      </label>

      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          name="isActive"
        />
        {t('isActive')}
      </label>

      {meal && (
        <fieldset style={fieldsetStyle}>
          <legend style={mutedLabel}>{t('photo')}</legend>
          {/* Capped: a 4:3 frame across the full width of a desktop form is a
              lot of empty grey for a picture that may not exist yet. */}
          <div style={{ maxWidth: '320px' }}>
            <MealThumbnail meal={uploaded ?? meal} label={t('noPhoto')} />
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={(e) => void upload(e)}
            disabled={uploading}
            aria-label={t('choosePhoto')}
            style={{ marginTop: '0.6rem', font: 'inherit', maxWidth: '100%' }}
          />
          {uploading && (
            <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('uploading')}</p>
          )}
          {uploadError && (
            <p role="alert" style={errorText}>
              {uploadError}
            </p>
          )}
          <p style={{ ...mutedLabel, textTransform: 'none', letterSpacing: 0 }}>
            {t('uploadNote')}
          </p>
        </fieldset>
      )}

      {error && (
        <p role="alert" style={errorText}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="submit" disabled={busy} style={primaryButton}>
          {busy
            ? meal
              ? t('saving')
              : t('creating')
            : meal
              ? t('save')
              : t('create')}
        </button>
        <button type="button" onClick={onCancel} style={secondaryButton}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

const gridStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  // min(260px, 100%) so a narrow phone gets one column instead of a track
  // wider than the screen — the usual source of a sideways scroll.
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
  gap: '1rem',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  minWidth: 0,
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius)',
  padding: '1rem',
};

const placeholderStyle: React.CSSProperties = {
  width: '100%',
  aspectRatio: '4 / 3',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bobr-surface-sunken)',
  border: '1px dashed var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
  minWidth: 0,
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius)',
  padding: '1rem',
};

const twoColumns: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
  gap: '0.9rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  minWidth: 0,
  fontSize: 'var(--bobr-text-sm)',
  fontWeight: 500,
};

const fieldStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  marginTop: '0.3rem',
  padding: '0.6rem 0.7rem',
  font: 'inherit',
  color: 'var(--bobr-fg)',
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
};

const fieldsetStyle: React.CSSProperties = {
  minWidth: 0,
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
  padding: '0.75rem',
};

const primaryButton: React.CSSProperties = {
  padding: '0.6rem 1.1rem',
  font: 'inherit',
  fontWeight: 600,
  color: 'var(--bobr-on-accent)',
  background: 'var(--bobr-accent)',
  border: 0,
  borderRadius: 'var(--bobr-radius-sm)',
  cursor: 'pointer',
};

const secondaryButton: React.CSSProperties = {
  padding: '0.6rem 1.1rem',
  font: 'inherit',
  fontWeight: 600,
  color: 'var(--bobr-fg)',
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
  cursor: 'pointer',
};

const badgeStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '0.15rem 0.5rem',
  fontSize: 'var(--bobr-text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-sm)',
};

const mutedLabel: React.CSSProperties = {
  fontSize: 'var(--bobr-text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--bobr-fg-muted)',
};

const errorText: React.CSSProperties = {
  color: 'var(--bobr-danger)',
  whiteSpace: 'pre-line',
};
