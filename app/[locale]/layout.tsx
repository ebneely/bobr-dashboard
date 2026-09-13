import type { Metadata } from 'next';
import { Jost } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { routing } from '@/lib/i18n/routing';
import { QueryProvider } from '@/lib/hooks/query-provider';

// The storefront's typeface, so the dashboard reads as the same brand.
// latin-ext carries the Polish diacritics.
const jost = Jost({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jost',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BOBR — Panel',
  // Behind a login and full of customer data. Never indexed; the
  // X-Robots-Tag header in next.config.ts is the belt to this suspenders.
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for static rendering — without it every page under this layout
  // silently opts into dynamic rendering.
  setRequestLocale(locale);

  return (
    // The font variable goes on <html>, not <body>: globals.css reads it from
    // body's font-family, and the variable must be defined on an ancestor.
    <html lang={locale} className={jost.variable}>
      <body>
        <NextIntlClientProvider>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
