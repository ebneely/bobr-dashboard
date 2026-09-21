'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SettingField, SettingImage, SettingsSchema, SettingsSection, SettingsValues } from '@/lib/api/settings';
import { usePatchSettings, useUploadSettingImage } from '@/lib/hooks/use-settings';
import { buildPatch, draftsFor, isDirty, toDraft, type Draft } from '@/lib/settings/draft';
import {
  fieldForPath,
  fieldIssuesOf,
  useDescribeError,
  useIssueMessage,
  useSettingsText,
} from '@/lib/settings/use-settings-text';

import { ClosedDaysManager } from './ClosedDaysManager';
import { SettingControl, type FieldErrors } from './SettingControl';

export const CLOSED_DAYS_TAB = 'closedDays';

/**
 * Every setting the registry has, one tab per section in the schema's order,
 * plus the closed-days calendar. Each section saves on its own with a PATCH of
 * only its changed keys; another section's unsaved edits are left alone.
 */
export function SettingsForm({
  schema,
  values,
  initialTab,
}: {
  schema: SettingsSchema;
  values: SettingsValues;
  initialTab?: string;
}) {
  const t = useTranslations('settings');
  const text = useSettingsText();
  const locale = useLocale();
  const issueMessage = useIssueMessage();
  const describe = useDescribeError();
  const patch = usePatchSettings();
  const upload = useUploadSettingImage();

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => draftsFor(schema, values, locale));
  /** Worded errors by full path: `key`, `key.pl`, `key.0.minDays`. */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);

  // New values from the server (a save's answer carries every key, including
  // what another admin changed meanwhile) flow into every field the person
  // has not touched. Only real edits count as unsaved — and a stale value is
  // never sent back over someone else's change.
  const [seenValues, setSeenValues] = useState(values);
  if (seenValues !== values) {
    setSeenValues(values);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const section of schema.sections) {
        for (const field of section.fields) {
          if (!isDirty(field, prev[field.key], seenValues[field.key])) {
            next[field.key] = toDraft(field, values[field.key], locale);
          }
        }
      }
      return next;
    });
  }

  const sectionOfKey = new Map<string, SettingsSection>();
  schema.sections.forEach((section) => section.fields.forEach((f) => sectionOfKey.set(f.key, section)));

  function errorsFor(key: string): FieldErrors {
    const own: FieldErrors = {};
    for (const [path, message] of Object.entries(errors)) {
      if (path === key) own[''] = message;
      else if (path.startsWith(`${key}.`)) own[path.slice(key.length + 1)] = message;
    }
    return own;
  }

  function withoutErrorsOf(keys: string[], from: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(from).filter(([path]) => !keys.some((key) => path === key || path.startsWith(`${key}.`))),
    );
  }

  function change(key: string, draft: Draft) {
    setDrafts((prev) => ({ ...prev, [key]: draft }));
    setErrors((prev) => withoutErrorsOf([key], prev));
  }

  function dirtyFields(section: SettingsSection): SettingField[] {
    return section.fields.filter((field) => isDirty(field, drafts[field.key], values[field.key]));
  }

  function reset(section: SettingsSection) {
    const keys = section.fields.map((f) => f.key);
    setDrafts((prev) => ({
      ...prev,
      ...Object.fromEntries(section.fields.map((f) => [f.key, toDraft(f, values[f.key], locale)])),
    }));
    setErrors((prev) => withoutErrorsOf(keys, prev));
    setSectionErrors((prev) => ({ ...prev, [section.id]: null }));
  }

  /** A 422 from the server → each issue under its field; anything unplaceable → the section. */
  function showFailure(section: SettingsSection, error: unknown, fallback: string) {
    const issues = fieldIssuesOf(error);
    if (!issues) {
      setSectionErrors((prev) => ({ ...prev, [section.id]: describe(error, fallback) }));
      return;
    }
    const placed: Record<string, string> = {};
    const loose: string[] = [];
    for (const issue of issues) {
      const field = fieldForPath(schema, issue.field);
      const message = issue.code
        ? issueMessage({ code: issue.code, params: issue.params }, field, issue.issue)
        : issue.issue;
      if (field && sectionOfKey.has(issue.field.split('.')[0])) placed[issue.field] = message;
      else loose.push(`${issue.field}: ${message}`);
    }
    setErrors((prev) => ({ ...prev, ...placed }));
    setSectionErrors((prev) => ({
      ...prev,
      [section.id]: loose.length ? loose.join('\n') : t('ui.fixFields'),
    }));
  }

  async function save(section: SettingsSection) {
    const keys = section.fields.map((f) => f.key);
    setErrors((prev) => withoutErrorsOf(keys, prev));
    setSectionErrors((prev) => ({ ...prev, [section.id]: null }));

    const built = buildPatch(section.fields, drafts, values);
    if (!built.ok) {
      const worded: Record<string, string> = {};
      for (const [path, issue] of Object.entries(built.issues)) {
        worded[path] = issueMessage(issue, fieldForPath(schema, path));
      }
      setErrors((prev) => ({ ...prev, ...worded }));
      setSectionErrors((prev) => ({ ...prev, [section.id]: t('ui.fixFields') }));
      return;
    }
    const changed = Object.keys(built.patch);
    if (changed.length === 0) return;

    setSaving(section.id);
    try {
      const response = await patch.mutateAsync(built.patch);
      // Re-read what the server stored: it trims, normalises the BLIK number
      // and sorts list rows, and the form should show exactly that.
      setDrafts((prev) => ({
        ...prev,
        ...Object.fromEntries(
          section.fields
            .filter((f) => changed.includes(f.key))
            .map((f) => [f.key, toDraft(f, response.values[f.key], locale)]),
        ),
      }));
      toast.success(t('ui.saved', { section: text(section.labelKey, section.id) }));
    } catch (error) {
      showFailure(section, error, t('ui.saveFailed'));
    } finally {
      setSaving(null);
    }
  }

  function imageActions(section: SettingsSection, field: SettingField) {
    return {
      value: (values[field.key] as SettingImage | null) ?? null,
      clearing: clearing === field.key,
      onUpload: async (file: Blob) => {
        await upload.mutateAsync({ key: field.key, file });
        toast.success(t('ui.imageSaved'));
      },
      onClear: () => {
        setClearing(field.key);
        patch
          .mutateAsync({ [field.key]: null })
          .then(() => toast.success(t('ui.imageCleared')))
          .catch((error: unknown) => showFailure(section, error, t('ui.saveFailed')))
          .finally(() => setClearing(null));
      },
    };
  }

  const firstTab = schema.sections[0]?.id ?? CLOSED_DAYS_TAB;

  return (
    <Tabs defaultValue={initialTab ?? firstTab} className="gap-4">
      <TabsList className="flex-wrap group-data-horizontal/tabs:h-auto" aria-label={t('ui.sectionsLabel')}>
        {schema.sections.map((section) => {
          const dirty = dirtyFields(section).length > 0;
          return (
            <TabsTrigger key={section.id} value={section.id} data-testid={`settings-tab-${section.id}`}>
              {text(section.labelKey, section.id)}
              {dirty ? (
                <span className="size-1.5 rounded-full bg-primary" aria-label={t('ui.unsavedTab')} />
              ) : null}
            </TabsTrigger>
          );
        })}
        <TabsTrigger value={CLOSED_DAYS_TAB} data-testid={`settings-tab-${CLOSED_DAYS_TAB}`}>
          {t('closedDays.tab')}
        </TabsTrigger>
      </TabsList>

      {schema.sections.map((section) => {
        const dirty = dirtyFields(section);
        const busy = saving === section.id;
        const sectionHelp = text(`settings.sectionHelp.${section.id}`);
        const sectionError = sectionErrors[section.id];
        return (
          <TabsContent key={section.id} value={section.id} data-testid={`settings-section-${section.id}`}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{text(section.labelKey, section.id)}</CardTitle>
                {sectionHelp ? <CardDescription>{sectionHelp}</CardDescription> : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {section.fields.map((field, index) => (
                  <div key={field.key} className="flex flex-col gap-5">
                    {index > 0 ? <Separator /> : null}
                    <SettingControl
                      field={field}
                      draft={drafts[field.key]}
                      onChange={(draft) => change(field.key, draft)}
                      errors={errorsFor(field.key)}
                      disabled={busy}
                      image={field.control === 'image' ? imageActions(section, field) : undefined}
                    />
                  </div>
                ))}
                {sectionError ? (
                  <Alert variant="destructive" data-testid="settings-section-error">
                    <AlertTitle>{t('ui.errorTitle')}</AlertTitle>
                    <AlertDescription className="whitespace-pre-line">{sectionError}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
              <CardFooter className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void save(section)}
                  disabled={busy || dirty.length === 0}
                  data-testid={`settings-save-${section.id}`}
                >
                  {busy ? t('ui.saving') : t('ui.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reset(section)}
                  disabled={busy || dirty.length === 0}
                  data-testid={`settings-reset-${section.id}`}
                >
                  {t('ui.reset')}
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {dirty.length > 0 ? t('ui.unsaved', { count: dirty.length }) : t('ui.upToDate')}
                </span>
              </CardFooter>
            </Card>
          </TabsContent>
        );
      })}

      <TabsContent value={CLOSED_DAYS_TAB} data-testid={`settings-section-${CLOSED_DAYS_TAB}`}>
        <ClosedDaysManager />
      </TabsContent>
    </Tabs>
  );
}
