import { apiFetch } from './client';
import { uploadFileName } from '@/lib/image-crop';
import type { MealType } from './orders';

/**
 * The menu. Mirrors bobr_backend/src/menu/ and the contract pinned in
 * ebneely/bobr-backend#28 — same enum spellings in all three repos.
 *
 * Dishes are separate from meals (diets): a dish may point at one diet through
 * `mealId`, and its `diet` is that meal's type. Dishes carry no price; diets
 * are what is bought. The printed menu is ONE current document, a PDF or an
 * image, and uploading replaces it.
 */

/** Eating order. The page lists courses in exactly this order. */
export const MENU_COURSES = [
  'BREAKFAST',
  'SECOND_BREAKFAST',
  'LUNCH',
  'SNACK',
  'DINNER',
] as const;
export type MenuCourse = (typeof MENU_COURSES)[number];

/**
 * The EU 14 (Regulation 1169/2011, Annex II), in the Annex's order — which is
 * the order Polish menus number them in, so index + 1 is the printed number.
 */
export const ALLERGENS = [
  'GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'PEANUTS',
  'SOY',
  'MILK',
  'NUTS',
  'CELERY',
  'MUSTARD',
  'SESAME',
  'SULPHITES',
  'LUPIN',
  'MOLLUSCS',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export type MenuDocumentKind = 'PDF' | 'IMAGE';

export interface MenuDocument {
  kind: MenuDocumentKind;
  url: string;
  /** A rendered first page for a PDF, the image itself for an image; may be null. */
  previewUrl: string | null;
  updatedAt: string;
}

/**
 * A dish as the admin endpoints return it — inactive ones included. The public
 * item plus sortOrder, isActive and the timestamps; no storage key, the URL is
 * built at read time.
 */
export interface AdminMenuItem {
  id: string;
  course: MenuCourse;
  /** In the request locale. The page reads namePl/nameEn directly. */
  name?: string;
  description?: string | null;
  namePl: string;
  nameEn: string;
  descriptionPl: string | null;
  descriptionEn: string | null;
  mealId: string | null;
  /** The linked meal's type. Optional so a freshly-built fixture need not spell it. */
  diet?: MealType | null;
  /** Whole kcal and whole grams — integers, never fractions. */
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  allergens: Allergen[];
  tags: string[];
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuItemInput {
  course: MenuCourse;
  namePl: string;
  nameEn: string;
  descriptionPl: string | null;
  descriptionEn: string | null;
  mealId: string | null;
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  allergens: Allergen[];
  tags: string[];
  sortOrder: number;
  isActive: boolean;
}

/** GET /v1/menu — public, active dishes only. */
export interface PublicMenu {
  document: MenuDocument | null;
  items: Array<{
    id: string;
    course: MenuCourse;
    name: string;
    description: string | null;
    namePl: string;
    nameEn: string;
    descriptionPl: string | null;
    descriptionEn: string | null;
    diet: MealType | null;
    mealId: string | null;
    kcal: number | null;
    proteinG: number | null;
    fatG: number | null;
    carbsG: number | null;
    allergens: Allergen[];
    tags: string[];
    imageUrl: string | null;
  }>;
}

/** Largest upload the backend accepts, for a PDF and an image alike. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';

// ---------------------------------------------------------------------------
// Requests

export function apiGetPublicMenu(locale: string) {
  return apiFetch<PublicMenu>(`/menu?locale=${encodeURIComponent(locale)}`, {
    auth: false,
  });
}

/** A bare array, ordered by course then sortOrder. */
export function apiAdminListMenuItems() {
  return apiFetch<AdminMenuItem[]>('/menu/admin/items');
}

export function apiAdminCreateMenuItem(input: MenuItemInput) {
  return apiFetch<AdminMenuItem>('/menu/admin/items', { method: 'POST', body: input });
}

export function apiAdminUpdateMenuItem(id: string, input: Partial<MenuItemInput>) {
  return apiFetch<AdminMenuItem>(`/menu/admin/items/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function apiAdminDeleteMenuItem(id: string) {
  return apiFetch<void>(`/menu/admin/items/${id}`, { method: 'DELETE' });
}

export function apiAdminUploadMenuItemImage(id: string, file: Blob) {
  const form = new FormData();
  form.append('file', file, uploadFileName(file));
  return apiFetch<AdminMenuItem>(`/menu/admin/items/${id}/image`, {
    method: 'POST',
    body: form,
  });
}

export function apiAdminUploadMenuDocument(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<MenuDocument>('/menu/admin/document', { method: 'POST', body: form });
}

export function apiAdminDeleteMenuDocument() {
  return apiFetch<void>('/menu/admin/document', { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Pure helpers — no React, unit-tested in __tests__/menu.test.ts

/** Dishes of each course, in eating order, each course sorted by sortOrder. */
export function groupByCourse(
  items: readonly AdminMenuItem[],
): Array<{ course: MenuCourse; items: AdminMenuItem[] }> {
  return MENU_COURSES.map((course) => ({
    course,
    items: items
      .filter((item) => item.course === course)
      // Ties (two dishes both at 0, the column default) fall back to the name
      // so the list is stable between renders.
      .sort((a, b) => a.sortOrder - b.sortOrder || a.namePl.localeCompare(b.namePl, 'pl')),
  }));
}

/** The sortOrder that places a new dish last in its course. */
export function nextSortOrder(items: readonly AdminMenuItem[], course: MenuCourse): number {
  const orders = items.filter((item) => item.course === course).map((item) => item.sortOrder);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

/**
 * Moving one dish up or down within its course.
 *
 * Returns the PATCHes to send: every dish in the course renumbered 0..n-1 in
 * the new order, keeping only those whose number actually changed. Swapping
 * two sortOrders would do nothing when both are 0 (the default), so the
 * course is renumbered instead. Empty when the move is impossible.
 */
export function reorderWithinCourse(
  items: readonly AdminMenuItem[],
  id: string,
  direction: 'up' | 'down',
): Array<{ id: string; sortOrder: number }> {
  const moving = items.find((item) => item.id === id);
  if (!moving) return [];
  const course = groupByCourse(items).find((group) => group.course === moving.course)!.items;
  const from = course.findIndex((item) => item.id === id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= course.length) return [];

  const next = [...course];
  [next[from], next[to]] = [next[to], next[from]];
  return next
    .map((item, index) => ({ id: item.id, sortOrder: index, before: item.sortOrder }))
    .filter((row) => row.sortOrder !== row.before)
    .map(({ id: rowId, sortOrder }) => ({ id: rowId, sortOrder }));
}

/**
 * The text of a kcal or gram field → a whole number, null for empty, or
 * `undefined` for anything that is not a non-negative integer. Never a float:
 * "12.5" and "12,5" are refused rather than rounded behind the admin's back.
 */
export function parseWholeNumber(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!/^\d{1,5}$/.test(trimmed)) return undefined;
  return Number.parseInt(trimmed, 10);
}

/** "wegańskie, bez cukru,  , Wegańskie" → ["wegańskie", "bez cukru"]. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of text.split(/[,;\n]+/)) {
    const tag = raw.trim().replace(/\s+/g, ' ');
    if (tag === '') continue;
    const key = tag.toLocaleLowerCase('pl');
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}
