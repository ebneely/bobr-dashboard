'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  apiAdminCreateMenuItem,
  apiAdminDeleteMenuDocument,
  apiAdminDeleteMenuItem,
  apiAdminListMenuItems,
  apiAdminUpdateMenuItem,
  apiAdminUploadMenuDocument,
  apiAdminUploadMenuItemImage,
  apiGetPublicMenu,
  type AdminMenuItem,
  type MenuItemInput,
} from '@/lib/api/menu';
import { apiAdminListMeals } from '@/lib/api/orders';

/**
 * React Query hooks for the Menu admin page.
 *
 * Every mutation invalidates the whole `menu` key: the admin list and the
 * public menu (which is where the current document is read from — there is no
 * admin GET for it) both change when a dish or the document does.
 */
export const menuKeys = {
  all: ['menu'] as const,
  adminItems: ['menu', 'admin', 'items'] as const,
  public: (locale: string) => ['menu', 'public', locale] as const,
};

export function useAdminMenuItems() {
  return useQuery({ queryKey: menuKeys.adminItems, queryFn: apiAdminListMenuItems });
}

/** The public menu; the admin page uses it for the current document. */
export function usePublicMenu(locale: string) {
  return useQuery({
    queryKey: menuKeys.public(locale),
    queryFn: () => apiGetPublicMenu(locale),
  });
}

/** Meals (diets) a dish can be linked to. */
export function useAdminMealsForMenu() {
  return useQuery({ queryKey: ['meals', 'admin'], queryFn: apiAdminListMeals });
}

function useInvalidateMenu() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: menuKeys.all });
}

/**
 * Create or update one dish, then — when a photo was chosen in the dialog —
 * upload it against the saved id. A new dish has no id until the POST answers,
 * so the photo cannot go first.
 */
export function useSaveMenuItem() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      photo,
    }: {
      id: string | null;
      input: MenuItemInput;
      photo: File | null;
    }) => {
      const saved = id
        ? await apiAdminUpdateMenuItem(id, input)
        : await apiAdminCreateMenuItem(input);
      if (!photo) return { saved, photoError: null };
      try {
        return { saved: await apiAdminUploadMenuItemImage(saved.id, photo), photoError: null };
      } catch (error) {
        // The dish is saved; only the photo failed. Report both facts rather
        // than rolling back a save the admin already made.
        return { saved, photoError: error };
      }
    },
    onSettled: invalidate,
  });
}

export function useDeleteMenuItem() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (id: string) => apiAdminDeleteMenuItem(id),
    onSettled: invalidate,
  });
}

/**
 * Up/down reorder. The new order is written into the cache first so the row
 * moves under the admin's finger, then the PATCHes go out; a failure restores
 * the previous list.
 */
export function useReorderMenuItems() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Array<{ id: string; sortOrder: number }>) => {
      await Promise.all(
        updates.map(({ id, sortOrder }) => apiAdminUpdateMenuItem(id, { sortOrder })),
      );
    },
    onMutate: async (updates) => {
      await client.cancelQueries({ queryKey: menuKeys.adminItems });
      const previous = client.getQueryData<AdminMenuItem[]>(menuKeys.adminItems);
      if (previous) {
        const byId = new Map(updates.map((row) => [row.id, row.sortOrder]));
        client.setQueryData<AdminMenuItem[]>(
          menuKeys.adminItems,
          previous.map((item) =>
            byId.has(item.id) ? { ...item, sortOrder: byId.get(item.id)! } : item,
          ),
        );
      }
      return { previous };
    },
    onError: (_error, _updates, context) => {
      if (context?.previous) client.setQueryData(menuKeys.adminItems, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: menuKeys.all }),
  });
}

export function useUploadMenuDocument() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (file: File) => apiAdminUploadMenuDocument(file),
    onSettled: invalidate,
  });
}

export function useDeleteMenuDocument() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: () => apiAdminDeleteMenuDocument(),
    onSettled: invalidate,
  });
}
