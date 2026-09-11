import { defineRouting } from 'next-intl/routing';

export const locales = ['pl', 'en'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  // Poland is the market, so Polish is the default rather than English.
  defaultLocale: 'pl',
  // 'as-needed' would leave Polish pages on bare paths (/menu) and English on
  // /en/menu. 'always' is used instead so every page has exactly one canonical
  // URL shape — a bare path that sometimes means Polish and sometimes redirects
  // is the kind of thing that quietly splits search ranking across two URLs.
  localePrefix: 'always',
});
