'use client';

import { useMemo } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { ImageField } from '@/components/ImageField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { SettingColumn, SettingField, SettingImage } from '@/lib/api/settings';
import { cn } from '@/lib/cn';
import { duplicateRows, isUnsorted, newRow, type Draft, type DraftRow } from '@/lib/settings/draft';
import { useSettingsText } from '@/lib/settings/use-settings-text';

/** Worded problems for one field, by sub-path ('' = the field itself). */
export type FieldErrors = Record<string, string>;

export interface ImageActions {
  value: SettingImage | null;
  onUpload: (file: Blob) => Promise<void>;
  onClear: () => void;
  clearing: boolean;
}

interface ControlProps {
  field: SettingColumn;
  id: string;
  draft: Draft;
  onChange: (draft: Draft) => void;
  invalid: boolean;
  describedBy?: string;
  disabled?: boolean;
}

/**
 * One setting from the registry: label, the control its `control` names, the
 * help line, a "not in effect yet" note and its errors. No setting has markup
 * of its own — a new registry key renders here without a code change.
 */
export function SettingControl({
  field,
  draft,
  onChange,
  errors,
  disabled,
  image,
}: {
  field: SettingField;
  draft: Draft;
  onChange: (draft: Draft) => void;
  errors: FieldErrors;
  disabled?: boolean;
  image?: ImageActions;
}) {
  const t = useTranslations('settings.ui');
  const text = useSettingsText();
  const id = `setting-${field.key}`;
  const label = text(field.labelKey, field.key);
  const help = text(field.helpKey);
  const own = errors[''];
  const helpId = help ? `${id}-help` : undefined;
  const errorId = own ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const notEnforced = field.enforced === false ? (
    <Badge variant="outline" className="font-normal text-muted-foreground" title={t('notEnforcedHint')}>
      {t('notEnforced')}
    </Badge>
  ) : null;

  if (field.control === 'image' && image) {
    return (
      <div className="flex flex-col gap-2" data-testid={`setting-${field.key}`}>
        <ImageField
          label={label}
          value={image.value?.url ?? null}
          hint={help || undefined}
          disabled={disabled}
          onUpload={image.onUpload}
        />
        <div className="flex flex-wrap items-center gap-2">
          {image.value ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || image.clearing}
              onClick={image.onClear}
              data-testid={`setting-${field.key}-clear`}
            >
              {image.clearing ? t('clearingImage') : t('clearImage')}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{t('noImage')}</span>
          )}
          {notEnforced}
        </div>
        {own ? <FieldError id={errorId}>{own}</FieldError> : null}
      </div>
    );
  }

  const inline = field.control === 'toggle';
  // Controls made of several inputs are a labelled group; single inputs are
  // labelled directly through htmlFor.
  const grouped = ['weekdays', 'list', 'localizedText', 'radio'].includes(field.control);

  return (
    <div
      className="flex flex-col gap-2"
      data-testid={`setting-${field.key}`}
      role={grouped ? 'group' : undefined}
      aria-labelledby={grouped ? `${id}-label` : undefined}
    >
      <div className={cn('flex flex-wrap items-center gap-2', inline && 'justify-between')}>
        <div className="flex flex-wrap items-center gap-2">
          <Label id={`${id}-label`} htmlFor={grouped ? undefined : id}>
            {label}
          </Label>
          {notEnforced}
        </div>
        {inline ? (
          <Switch
            id={id}
            checked={draft === true}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={Boolean(own) || undefined}
          />
        ) : null}
      </div>

      {inline ? null : field.control === 'list' ? (
        <ListControl field={field} draft={draft} onChange={onChange} errors={errors} disabled={disabled} />
      ) : field.control === 'localizedText' ? (
        <LocalizedControl field={field} id={id} draft={draft} onChange={onChange} errors={errors} disabled={disabled} />
      ) : (
        <Control
          field={field}
          id={id}
          draft={draft}
          onChange={onChange}
          invalid={Boolean(own)}
          describedBy={describedBy}
          disabled={disabled}
        />
      )}

      {help ? (
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
      {own ? <FieldError id={errorId}>{own}</FieldError> : null}
    </div>
  );
}

function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs whitespace-pre-line text-destructive" data-testid="setting-error">
      {children}
    </p>
  );
}

/** A unit after the input: "zł", "dni", "%". */
function WithUnit({ unit, children }: { unit?: string; children: React.ReactNode }) {
  const t = useTranslations('settings.units');
  if (!unit) return <>{children}</>;
  return (
    <div className="flex items-center gap-2">
      {children}
      <span className="text-sm text-muted-foreground">{t.has(unit) ? t(unit) : unit}</span>
    </div>
  );
}

/** The single-value controls, shared by top-level fields and list cells. */
function Control({ field, id, draft, onChange, invalid, describedBy, disabled }: ControlProps) {
  const t = useTranslations('settings.ui');
  const text = useSettingsText();
  const value = typeof draft === 'string' ? draft : '';
  const common = {
    id,
    disabled,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
  };

  switch (field.control) {
    case 'textarea':
      return (
        <Textarea
          {...common}
          name={field.key}
          value={value}
          maxLength={field.validation?.maxLength}
          rows={3}
          className="max-w-xl"
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'number':
      return (
        <WithUnit unit={field.unit}>
          <Input
            {...common}
            name={field.key}
            inputMode="numeric"
            value={value}
            placeholder={field.nullable ? t('emptyMeansNone') : undefined}
            className="w-28"
            onChange={(event) => onChange(event.target.value)}
          />
        </WithUnit>
      );
    case 'money':
      return (
        <WithUnit unit="zloty">
          <Input
            {...common}
            name={field.key}
            inputMode="decimal"
            value={value}
            placeholder="0,00"
            className="w-32"
            onChange={(event) => onChange(event.target.value)}
          />
        </WithUnit>
      );
    case 'time':
      return (
        <Input
          {...common}
          name={field.key}
          // Not type="time": Chrome shows that in the BROWSER's locale (08:00 AM
          // on an English system). The setting is a 24h Warsaw wall-clock time.
          inputMode="numeric"
          placeholder="08:00"
          maxLength={5}
          value={value}
          className="w-24"
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'select':
      return (
        <Select value={value} onValueChange={(next) => onChange(next)} disabled={disabled}>
          <SelectTrigger
            id={id}
            className="w-56"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
          >
            <SelectValue placeholder={t('choose')} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={String(option.value)} value={String(option.value)}>
                {text(option.labelKey, String(option.value))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'radio':
      return (
        <RadioGroup
          value={value}
          onValueChange={(next) => onChange(next)}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="flex flex-col gap-2"
        >
          {field.options?.map((option) => {
            const optionId = `${id}-${String(option.value)}`;
            return (
              <div key={String(option.value)} className="flex items-center gap-2">
                <RadioGroupItem id={optionId} value={String(option.value)} />
                <Label htmlFor={optionId} className="font-normal">
                  {text(option.labelKey, String(option.value))}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      );
    case 'weekdays':
      return <WeekdaysControl id={id} draft={draft} onChange={onChange} describedBy={describedBy} disabled={disabled} invalid={invalid} />;
    case 'toggle':
      return (
        <Switch
          id={id}
          checked={draft === true}
          onCheckedChange={(checked) => onChange(checked)}
          disabled={disabled}
        />
      );
    case 'text':
    default:
      return (
        <Input
          {...common}
          name={field.key}
          type={field.validation?.format === 'email' ? 'email' : 'text'}
          value={value}
          maxLength={field.validation?.maxLength}
          autoComplete="off"
          className="max-w-sm"
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

/** ISO 1 (Monday) … 7 (Sunday), named in the UI's locale. 2024-01-01 was a Monday. */
export function weekdayNames(locale: string, width: 'short' | 'long'): string[] {
  const format = new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    weekday: width,
    timeZone: 'UTC',
  });
  return [1, 2, 3, 4, 5, 6, 7].map((day) => format.format(new Date(Date.UTC(2024, 0, day))));
}

function WeekdaysControl({
  id,
  draft,
  onChange,
  describedBy,
  disabled,
  invalid,
}: {
  id: string;
  draft: Draft;
  onChange: (draft: Draft) => void;
  describedBy?: string;
  disabled?: boolean;
  invalid: boolean;
}) {
  const locale = useLocale();
  const short = useMemo(() => weekdayNames(locale, 'short'), [locale]);
  const long = useMemo(() => weekdayNames(locale, 'long'), [locale]);
  const days = Array.isArray(draft) ? (draft as number[]) : [];

  return (
    <ToggleGroup
      id={id}
      type="multiple"
      variant="outline"
      value={days.map(String)}
      onValueChange={(next) => onChange(next.map(Number).sort((a, b) => a - b))}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
    >
      {short.map((name, index) => (
        <ToggleGroupItem
          key={index + 1}
          value={String(index + 1)}
          aria-label={long[index]}
          className="min-w-12 capitalize"
          data-testid={`weekday-${index + 1}`}
        >
          {name}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function LocalizedControl({
  field,
  id,
  draft,
  onChange,
  errors,
  disabled,
}: {
  field: SettingField;
  id: string;
  draft: Draft;
  onChange: (draft: Draft) => void;
  errors: FieldErrors;
  disabled?: boolean;
}) {
  const t = useTranslations('settings.ui');
  const value = (draft ?? { pl: '', en: '' }) as { pl: string; en: string };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(['pl', 'en'] as const).map((lang) => {
        const inputId = `${id}-${lang}`;
        const error = errors[lang];
        return (
          <div key={lang} className="flex flex-col gap-1.5">
            <Label htmlFor={inputId} className="text-xs text-muted-foreground">
              {t(`language.${lang}`)}
            </Label>
            <Input
              id={inputId}
              name={`${field.key}.${lang}`}
              lang={lang}
              value={value[lang]}
              maxLength={field.validation?.maxLength}
              disabled={disabled}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
              onChange={(event) => onChange({ ...value, [lang]: event.target.value })}
            />
            {error ? <FieldError id={`${inputId}-error`}>{error}</FieldError> : null}
          </div>
        );
      })}
    </div>
  );
}

function ListControl({
  field,
  draft,
  onChange,
  errors,
  disabled,
}: {
  field: SettingField;
  draft: Draft;
  onChange: (draft: Draft) => void;
  errors: FieldErrors;
  disabled?: boolean;
}) {
  const t = useTranslations('settings.ui');
  const text = useSettingsText();
  const locale = useLocale();
  const rows = Array.isArray(draft) ? (draft as DraftRow[]) : [];
  const columns = field.item?.fields ?? [];
  const { uniqueBy, sortedBy, maxItems } = field.validation;
  const full = typeof maxItems === 'number' && rows.length >= maxItems;

  // Shown while typing, not only after a save: two rows on the same value is
  // a mistake the owner should see as soon as it is made.
  const duplicates = new Set(uniqueBy ? duplicateRows(rows, uniqueBy) : []);
  const unsorted = sortedBy ? isUnsorted(rows, sortedBy) : false;

  function setCell(index: number, column: string, value: Draft) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [column]: value } : row)));
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('listEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li
              key={index}
              className="flex flex-wrap items-start gap-3 rounded-lg border p-3"
              data-testid={`setting-${field.key}-row`}
            >
              {columns.map((column) => {
                const cellId = `setting-${field.key}-${index}-${column.key}`;
                const columnLabel = text(column.labelKey, column.key);
                const error =
                  errors[`${index}.${column.key}`] ??
                  (column.key === uniqueBy && duplicates.has(index) ? t('duplicateRow') : undefined);
                return (
                  <div key={column.key} className="flex flex-col gap-1.5">
                    <Label htmlFor={cellId} className="text-xs text-muted-foreground">
                      {columnLabel}
                    </Label>
                    <Control
                      field={column}
                      id={cellId}
                      draft={row[column.key]}
                      onChange={(value) => setCell(index, column.key, value)}
                      invalid={Boolean(error)}
                      describedBy={error ? `${cellId}-error` : undefined}
                      disabled={disabled}
                    />
                    {error ? <FieldError id={`${cellId}-error`}>{error}</FieldError> : null}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-5 ml-auto"
                disabled={disabled}
                aria-label={t('removeRow', { index: index + 1 })}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                data-testid={`setting-${field.key}-remove`}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || full}
          onClick={() => onChange([...rows, newRow(columns, locale)])}
          data-testid={`setting-${field.key}-add`}
        >
          <PlusIcon aria-hidden />
          {t('addRow')}
        </Button>
        {full ? <span className="text-xs text-muted-foreground">{t('listFull', { maximum: maxItems })}</span> : null}
        {unsorted && sortedBy ? (
          <span className="text-xs text-muted-foreground" data-testid={`setting-${field.key}-unsorted`}>
            {t('sortedOnSave', { column: text(columns.find((c) => c.key === sortedBy)?.labelKey, sortedBy) })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
