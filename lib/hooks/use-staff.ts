'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  apiAdminCreateStaff,
  apiAdminListStaff,
  apiAdminResetStaffPassword,
  apiAdminUpdateStaff,
  type CreateStaffInput,
} from '@/lib/api/staff';

/** React Query hooks for the SUPER_ADMIN staff page. */
export const staffKeys = { all: ['staff', 'admin'] as const };

export function useStaffList() {
  return useQuery({ queryKey: staffKeys.all, queryFn: apiAdminListStaff });
}

function useInvalidateStaff() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: staffKeys.all });
}

export function useCreateStaff() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (input: CreateStaffInput) => apiAdminCreateStaff(input),
    onSuccess: invalidate,
  });
}

export function useResetStaffPassword() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (id: string) => apiAdminResetStaffPassword(id),
    onSuccess: invalidate,
  });
}

export function useSetStaffActive() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiAdminUpdateStaff(id, { isActive }),
    onSuccess: invalidate,
  });
}
