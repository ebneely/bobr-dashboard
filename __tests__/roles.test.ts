import {
  ROLES,
  ROUTE_ACCESS,
  asRole,
  canAccess,
  cardsFor,
  isStaff,
  mustLeaveForPasswordChange,
  navItemsFor,
  type Role,
} from '@/lib/auth/roles';

const STAFF_PAGES = [
  '/dashboard',
  '/dashboard/deliveries',
  '/dashboard/orders',
  '/dashboard/meals',
  '/dashboard/menu',
  '/dashboard/customers',
  '/dashboard/consultations',
  '/dashboard/notes',
  '/dashboard/zones',
  '/dashboard/settings',
  '/dashboard/profile',
];

describe('roles', () => {
  it('knows exactly CUSTOMER, ADMIN and SUPER_ADMIN', () => {
    expect(ROLES).toEqual(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN']);
    expect(asRole('SUPER_ADMIN')).toBe('SUPER_ADMIN');
    expect(asRole('ADMIN')).toBe('ADMIN');
    expect(asRole('DOCTOR')).toBeNull();
  });

  it('treats ADMIN and SUPER_ADMIN as staff, CUSTOMER not', () => {
    expect(isStaff('ADMIN')).toBe(true);
    expect(isStaff('SUPER_ADMIN')).toBe(true);
    expect(isStaff('CUSTOMER')).toBe(false);
    expect(isStaff(undefined)).toBe(false);
    expect(isStaff(null)).toBe(false);
  });

  it('gives CUSTOMER no rule, no nav and no cards: the dashboard is staff-only', () => {
    for (const rule of ROUTE_ACCESS) expect(rule.roles).not.toContain('CUSTOMER');
    for (const path of STAFF_PAGES) expect(canAccess(path, 'CUSTOMER')).toBe(false);
    expect(canAccess('/dashboard/staff', 'CUSTOMER')).toBe(false);
    expect(navItemsFor('CUSTOMER')).toEqual([]);
    expect(cardsFor('CUSTOMER')).toEqual([]);
  });

  it('has no customer pages left', () => {
    const paths = ROUTE_ACCESS.map((rule) => rule.path);
    expect(paths).not.toContain('/dashboard/my-diet');
    expect(paths).not.toContain('/dashboard/calendar');
    expect(cardsFor('ADMIN')).not.toContain('myDiet');
    expect(cardsFor('ADMIN')).not.toContain('mealTracking');
  });

  it.each<Role>(['ADMIN', 'SUPER_ADMIN'])('%s reaches every staff page', (role) => {
    for (const path of STAFF_PAGES) expect(canAccess(path, role)).toBe(true);
    expect(canAccess('/dashboard/orders/abc', role)).toBe(true);
  });

  it('keeps the staff page for SUPER_ADMIN only', () => {
    expect(canAccess('/dashboard/staff', 'SUPER_ADMIN')).toBe(true);
    expect(canAccess('/dashboard/staff', 'ADMIN')).toBe(false);
    expect(canAccess('/dashboard/staff/anything', 'ADMIN')).toBe(false);
    expect(navItemsFor('SUPER_ADMIN').map((r) => r.path)).toContain('/dashboard/staff');
    expect(navItemsFor('ADMIN').map((r) => r.path)).not.toContain('/dashboard/staff');
    expect(cardsFor('SUPER_ADMIN')).toContain('staff');
    expect(cardsFor('ADMIN')).not.toContain('staff');
  });

  it('gives SUPER_ADMIN everything ADMIN has, plus staff', () => {
    const nav = (role: Role) => navItemsFor(role).map((rule) => rule.path);
    expect(nav('SUPER_ADMIN')).toEqual([...nav('ADMIN'), '/dashboard/staff']);
    expect(cardsFor('SUPER_ADMIN')).toEqual([...cardsFor('ADMIN'), 'staff']);
    // The profile page is reached from the shell footer, not the nav.
    expect(nav('ADMIN')).not.toContain('/dashboard/profile');
  });

  it('gives staff the deliveries screen, nav and overview card, CUSTOMER none', () => {
    expect(canAccess('/dashboard/deliveries', 'ADMIN')).toBe(true);
    expect(canAccess('/dashboard/deliveries', 'SUPER_ADMIN')).toBe(true);
    expect(canAccess('/dashboard/deliveries', 'CUSTOMER')).toBe(false);
    expect(navItemsFor('ADMIN').map((rule) => rule.path)).toContain('/dashboard/deliveries');
    expect(cardsFor('ADMIN')).toContain('deliveries');
  });

  it('lists Menu for staff; segment-aware matching', () => {
    expect(navItemsFor('ADMIN').map((rule) => rule.messageKey)).toContain('menu');
    expect(canAccess('/dashboard/menu/anything', 'CUSTOMER')).toBe(false);
    // A sibling path does not inherit the rule: /dashboard/staffX falls back to
    // the /dashboard rule, which ADMIN passes, rather than the SUPER_ADMIN one.
    expect(canAccess('/dashboard/staffX', 'ADMIN')).toBe(true);
  });

  describe('mustLeaveForPasswordChange', () => {
    it('holds a flagged user everywhere except the profile page', () => {
      expect(mustLeaveForPasswordChange('/dashboard', true)).toBe(true);
      expect(mustLeaveForPasswordChange('/dashboard/orders', true)).toBe(true);
      expect(mustLeaveForPasswordChange('/dashboard/profileX', true)).toBe(true);
      expect(mustLeaveForPasswordChange('/dashboard/profile', true)).toBe(false);
    });

    it('never holds an unflagged user', () => {
      expect(mustLeaveForPasswordChange('/dashboard/orders', false)).toBe(false);
    });
  });
});
