import type { ReactNode } from 'react';
import './globals.css';

/**
 * The real layout — <html>, providers, fonts — is app/[locale]/layout.tsx,
 * because the lang attribute depends on the locale segment. This root layout
 * exists only because Next requires one above a dynamic segment; it must not
 * render <html> or <body> itself or they would be nested twice.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
