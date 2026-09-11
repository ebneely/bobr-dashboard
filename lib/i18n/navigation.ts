import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Use these instead of the ones from `next/link` and `next/navigation` —
// they keep the active locale in the path automatically. A plain <Link href="/menu">
// drops the locale and bounces the user back through the middleware.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
