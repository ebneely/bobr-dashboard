'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { useAdminSettings, useSettingsSchema } from '@/lib/hooks/use-settings';
import { useDescribeError } from '@/lib/settings/use-settings-text';

import { CLOSED_DAYS_TAB, SettingsForm } from './SettingsForm';

/**
 * The settings page's client half: the registry's schema and current values,
 * then one generated form for all of them. Nothing here knows any setting by
 * name — the backend registry is the only list.
 */
export function SettingsClient() {
  const t = useTranslations('settings.ui');
  const describe = useDescribeError();
  const schema = useSettingsSchema();
  const values = useAdminSettings();
  // ?tab=<section id> opens that section (the overview's BLIK reminder links to payments).
  const requestedTab = useSearchParams().get('tab');

  const failed = schema.error ?? values.error;
  if (failed) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('loadFailed')}</AlertTitle>
        <AlertDescription className="whitespace-pre-line">
          {describe(failed, t('loadFailed'))}
        </AlertDescription>
      </Alert>
    );
  }

  if (!schema.data || !values.data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-full max-w-xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <SettingsForm
        schema={schema.data}
        values={values.data.values}
        initialTab={
          requestedTab &&
          (requestedTab === CLOSED_DAYS_TAB || schema.data.sections.some((s) => s.id === requestedTab))
            ? requestedTab
            : undefined
        }
      />
      <Toaster position="bottom-right" />
    </>
  );
}
