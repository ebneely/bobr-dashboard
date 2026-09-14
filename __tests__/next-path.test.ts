import { safeNextPath } from '@/lib/auth/next-path';
import { dashboardLoginPath } from '@/lib/auth/urls';

describe('safeNextPath', () => {
  it('accepts a local page in either locale', () => {
    expect(safeNextPath('/pl/dashboard')).toBe('/pl/dashboard');
    expect(safeNextPath('/en/dashboard/orders')).toBe('/en/dashboard/orders');
    expect(safeNextPath('/pl')).toBe('/pl');
  });

  it.each([
    ['nothing', null],
    ['undefined', undefined],
    ['empty', ''],
    ['another site', 'https://evil.com/pl/dashboard'],
    ['protocol-relative', '//evil.com'],
    ['a doubled slash inside', '/pl//evil.com'],
    ['a backslash', '/pl\evil.com'],
    ['no locale', '/dashboard'],
    ['an unknown locale', '/de/dashboard'],
    ['a locale prefix of another word', '/plx/dashboard'],
    ['a javascript url', 'javascript:alert(1)'],
    ['an encoded escape', '/pl/%2F%2Fevil.com'],
    ['a dot segment', '/pl/../../evil'],
    ['a query string', '/pl/dashboard?x=https://evil.com'],
    ['the login page (a redirect loop)', '/pl/login'],
    ['the login page with a trailing slash', '/en/login/'],
  ])('refuses %s', (_label, value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});

describe('dashboardLoginPath', () => {
  it('is the bare login page without a return path', () => {
    expect(dashboardLoginPath('pl')).toBe('/pl/login');
  });

  it('carries the return path, encoded, and it survives safeNextPath', () => {
    const url = new URL(dashboardLoginPath('en', '/en/dashboard'), 'http://x');
    expect(url.pathname).toBe('/en/login');
    expect(safeNextPath(url.searchParams.get('redirect'))).toBe('/en/dashboard');
  });
});
