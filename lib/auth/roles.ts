/**
 * Route → allowed-roles table for the dashboard.
 *
 * THIS MIRRORS THE BACKEND'S `@Roles()` GUARDS AND IS A UI COURTESY ONLY.
 * The backend is the real enforcement. Everything here decides what a person
 * is *shown*; nothing here decides what they can *fetch*. A hand-written
 * request to the API is answered by Nest's guard, not by this file — so when
 * a rule changes, change the guard first and this table second.
 *
 * It is a table rather than `if (role === 'ADMIN')` scattered across
 * components because the failure that costs money is a route that quietly
 * loses its check during a refactor. One table can be read top to bottom and
 * diffed against the controllers.
 */

/**
 * CUSTOMER orders and eats — on the storefront, never here: this panel is for
 * the BOBR team only, and the dashboard layout signs a customer out on sight.
 * ADMIN is the business owner — the doctor who runs the diets. SUPER_ADMIN is
 * the developers; on top of every ADMIN page they manage staff accounts.
 */
export const ROLES = ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Mirrors the backend's `STAFF_ROLES`. */
export const STAFF: readonly Role[] = ['ADMIN', 'SUPER_ADMIN'];

/** Mirrors `@Roles(Role.SUPER_ADMIN)` on the backend's staff controller. */
const SUPER_ADMIN_ONLY: readonly Role[] = ['SUPER_ADMIN'];

/** True for ADMIN and SUPER_ADMIN. The one place a staff check is spelled. */
export function isStaff(role: Role | null | undefined): boolean {
  return role != null && STAFF.includes(role);
}

export interface RouteRule {
  /** Locale-less path, as returned by `usePathname` from @/lib/i18n/navigation. */
  readonly path: string;
  /** Key under the `dashboard` namespace in messages/{pl,en}.json. */
  readonly messageKey: string;
  readonly roles: readonly Role[];
  /** Whether the shell lists it in the sidebar. */
  readonly nav: boolean;
}

/**
 * Every rule is staff or narrower. CUSTOMER appears in none of them: customer
 * pages (diet, calendar, own consultations, own notes) live in the storefront's
 * account area (ebneely/bobr-dashboard#38).
 */
export const ROUTE_ACCESS: readonly RouteRule[] = [
  { path: '/dashboard', messageKey: 'overview', roles: STAFF, nav: true },
  { path: '/dashboard/orders', messageKey: 'orders', roles: STAFF, nav: true },
  { path: '/dashboard/meals', messageKey: 'meals', roles: STAFF, nav: true },
  // The printed menu and the dishes behind the storefront's public /menu page.
  { path: '/dashboard/menu', messageKey: 'menu', roles: STAFF, nav: true },
  { path: '/dashboard/customers', messageKey: 'customers', roles: STAFF, nav: true },
  // Every booking; staff confirm them and mark them paid.
  { path: '/dashboard/consultations', messageKey: 'consultations', roles: STAFF, nav: true },
  // The queue of notes customers raised on the storefront.
  { path: '/dashboard/notes', messageKey: 'notes', roles: STAFF, nav: true },
  { path: '/dashboard/zones', messageKey: 'zones', roles: STAFF, nav: true },
  { path: '/dashboard/settings', messageKey: 'settings', roles: STAFF, nav: true },
  // Staff accounts: only a SUPER_ADMIN creates, resets or deactivates an ADMIN.
  { path: '/dashboard/staff', messageKey: 'staff', roles: SUPER_ADMIN_ONLY, nav: true },
  // Own account and change password. Reached from the shell's footer, and the
  // forced destination while a password must be changed.
  { path: '/dashboard/profile', messageKey: 'profile', roles: STAFF, nav: false },
];

/** Cards on the dashboard index, split the same way and from the same source. */
export const DASHBOARD_CARDS: readonly {
  readonly messageKey: string;
  readonly roles: readonly Role[];
}[] = [
  { messageKey: 'orders', roles: STAFF },
  { messageKey: 'meals', roles: STAFF },
  { messageKey: 'menu', roles: STAFF },
  { messageKey: 'customers', roles: STAFF },
  { messageKey: 'consultations', roles: STAFF },
  { messageKey: 'notes', roles: STAFF },
  { messageKey: 'zones', roles: STAFF },
  { messageKey: 'settings', roles: STAFF },
  { messageKey: 'staff', roles: SUPER_ADMIN_ONLY },
];

/** The dashboard's floor for a new password; the backend's own minimum is lower. */
export const MIN_PASSWORD_LENGTH = 12;

/** Where a staff member with `mustChangePassword` is held until they change it. */
export const PASSWORD_CHANGE_PATH = '/dashboard/profile';

/**
 * True when a person who must change their password is somewhere other than
 * the change-password page. `path` is locale-less. Both the server layout (on
 * a full load) and the client shell (on in-app navigation, where the layout
 * does not re-render) ask this one function.
 */
export function mustLeaveForPasswordChange(
  path: string,
  mustChangePassword: boolean,
): boolean {
  return mustChangePassword && !covers(PASSWORD_CHANGE_PATH, path);
}

/**
 * Segment-aware prefix match. Plain `startsWith` would let `/dashboard/mealsX`
 * inherit the rule for `/dashboard/meals`.
 */
function covers(rulePath: string, path: string): boolean {
  return path === rulePath || path.startsWith(`${rulePath}/`);
}

/** The most specific rule covering `path`, or undefined if the table has none. */
export function ruleFor(path: string): RouteRule | undefined {
  return ROUTE_ACCESS.filter((rule) => covers(rule.path, path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
}

/**
 * Paths the table says nothing about are allowed: this file gates the
 * dashboard, and treating every unlisted path as forbidden would break the
 * moment someone adds a route and forgets the table — while the backend guard
 * still refuses the data. Add the rule, do not rely on a default-deny here.
 */
export function canAccess(path: string, role: Role): boolean {
  const rule = ruleFor(path);
  return rule ? rule.roles.includes(role) : true;
}

export function navItemsFor(role: Role): readonly RouteRule[] {
  return ROUTE_ACCESS.filter((rule) => rule.nav && rule.roles.includes(role));
}

export function cardsFor(role: Role): readonly string[] {
  return DASHBOARD_CARDS.filter((card) => card.roles.includes(role)).map(
    (card) => card.messageKey,
  );
}

/** Where to send a role that landed somewhere it cannot be. Always non-empty:
 *  `/dashboard` is open to every staff role. */
export function firstAccessibleRoute(role: Role): string {
  return navItemsFor(role)[0]?.path ?? '/dashboard';
}

/** Narrow an unknown value (a JSON field from the auth server) to a Role. */
export function asRole(value: unknown): Role | null {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}
