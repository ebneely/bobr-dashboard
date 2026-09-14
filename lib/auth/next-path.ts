/**
 * Where to send someone after they sign in, if the page that sent them to log
 * in asked to be returned to. Copied from bobr_frontend/lib/auth/next-path.ts.
 *
 * Only a local page in one of our locales is accepted. Anything else — another
 * host, a protocol-relative `//host`, a backslash (browsers treat `/\host` as a
 * host), an encoded or dot-segment escape, a `javascript:` URL — returns null
 * and the caller falls back to the dashboard. An unchecked `?redirect=` is an
 * open redirect: a login link on our domain that lands on someone else's.
 *
 * The login page itself is refused too: a signed-in visitor is redirected
 * straight to this path, and `/pl/login?redirect=/pl/login` would loop.
 */
const LOCAL_PAGE = /^\/(pl|en)(\/[A-Za-z0-9_-]+)*\/?$/;
const LOGIN_PAGE = /^\/(pl|en)\/login\/?$/;

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return LOCAL_PAGE.test(raw) && !LOGIN_PAGE.test(raw) ? raw : null;
}
