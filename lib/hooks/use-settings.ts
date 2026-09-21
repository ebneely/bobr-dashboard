'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  apiAdminAddClosedDay,
  apiAdminDeleteClosedDay,
  apiAdminGetSettings,
  apiAdminGetSettingsSchema,
  apiAdminListClosedDays,
  apiAdminPatchSettings,
  apiAdminUploadSettingImage,
  type ClosedDay,
  type SettingsValues,
  type SettingsValuesResponse,
} from '@/lib/api/settings';

/** React Query hooks for the ADMIN settings page. */
export const settingsKeys = {
  all: ['settings'] as const,
  schema: ['settings', 'admin', 'schema'] as const,
  values: ['settings', 'admin', 'values'] as const,
  closedDays: ['settings', 'admin', 'closed-days'] as const,
};

export function useSettingsSchema() {
  return useQuery({ queryKey: settingsKeys.schema, queryFn: apiAdminGetSettingsSchema });
}

export function useAdminSettings() {
  return useQuery({ queryKey: settingsKeys.values, queryFn: apiAdminGetSettings });
}

/**
 * Stores the server's answer as the new values, then marks the rest of
 * ['settings'] stale — the overview's BLIK readiness check reads
 * ['settings', 'payment'], which a PATCH of blikPhone changes.
 */
function useStoreValues() {
  const client = useQueryClient();
  return (response: SettingsValuesResponse) => {
    client.setQueryData(settingsKeys.values, response);
    void client.invalidateQueries({
      queryKey: settingsKeys.all,
      predicate: (query) => query.queryKey[2] !== 'values' && query.queryKey[2] !== 'schema',
    });
  };
}

export function usePatchSettings() {
  const store = useStoreValues();
  return useMutation({
    mutationFn: (patch: SettingsValues) => apiAdminPatchSettings(patch),
    onSuccess: store,
  });
}

export function useUploadSettingImage() {
  const store = useStoreValues();
  return useMutation({
    mutationFn: ({ key, file }: { key: string; file: Blob }) =>
      apiAdminUploadSettingImage(key, file),
    onSuccess: store,
  });
}

export function useClosedDays() {
  return useQuery({ queryKey: settingsKeys.closedDays, queryFn: apiAdminListClosedDays });
}

function useInvalidateClosedDays() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: settingsKeys.closedDays });
}

export function useAddClosedDay() {
  const invalidate = useInvalidateClosedDays();
  return useMutation({
    mutationFn: (input: ClosedDay) => apiAdminAddClosedDay(input),
    onSuccess: invalidate,
  });
}

export function useDeleteClosedDay() {
  const invalidate = useInvalidateClosedDays();
  return useMutation({
    mutationFn: (date: string) => apiAdminDeleteClosedDay(date),
    onSuccess: invalidate,
  });
}
