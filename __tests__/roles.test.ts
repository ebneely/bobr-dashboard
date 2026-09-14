import {
  ROLES,
  asRole,
  canAccess,
  cardsFor,
  isStaff,
  navItemsFor,
  type Role,
} from '@/lib/auth/roles';

const STAFF_ONLY = [
  '/dashboard/orders',
  '/dashboard/meals',
  '/dashboard/menu',
  '/dashboard/customers',
  '/dashboard/zones',
  '/dashboard/settings',
];
const CUSTOMER_ONLY = ['/dashboard/my-diet', '/dashboard/calendar'];
const EVERYONE = ['/dashboard', '/dashboard/consultations', '/dashboard/notes', '/dashboard/profile'];

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

  it.each<Role>(['ADMIN', 'SUPER_ADMIN'])('%s reaches every staff page', (role) => {
    for (const path of [...STAFF_ONLY, ...EVERYONE]) {
      expect(canAccess(path, role)).toBe(true);
    }
    expect(canAccess('/dashboard/orders/abc', role)).toBe(true);
    for (const path of CUSTOMER_ONLY) expect(canAccess(path, role)).toBe(false);
  });

  it('keeps CUSTOMER out of staff pages', () => {
    for (const path of STAFF_ONLY) expect(canAccess(path, 'CUSTOMER')).toBe(false);
    for (const path of [...CUSTOMER_ONLY, ...EVERYONE]) {
      expect(canAccess(path, 'CUSTOMER')).toBe(true);
    }
  });

  it('lists Menu in the staff sidebar and on the staff overview, never for CUSTOMER', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
      expect(navItemsFor(role).map((rule) => rule.messageKey)).toContain('menu');
      expect(cardsFor(role)).toContain('menu');
    }
    expect(navItemsFor('CUSTOMER').map((rule) => rule.path)).not.toContain('/dashboard/menu');
    expect(cardsFor('CUSTOMER')).not.toContain('menu');
    // Segment-aware: a sibling path does not inherit the rule.
    expect(canAccess('/dashboard/menuX', 'CUSTOMER')).toBe(true);
    expect(canAccess('/dashboard/menu/anything', 'CUSTOMER')).toBe(false);
  });

  it('gives ADMIN and SUPER_ADMIN the same nav and cards, without customer pages', () => {
    const nav = (role: Role) => navItemsFor(role).map((rule) => rule.path);
    expect(nav('SUPER_ADMIN')).toEqual(nav('ADMIN'));
    expect(cardsFor('SUPER_ADMIN')).toEqual(cardsFor('ADMIN'));
    for (const path of CUSTOMER_ONLY) expect(nav('SUPER_ADMIN')).not.toContain(path);
    expect(nav('SUPER_ADMIN')).toEqual(expect.arrayContaining(STAFF_ONLY));
    expect(cardsFor('SUPER_ADMIN')).not.toContain('myDiet');
    expect(cardsFor('SUPER_ADMIN')).toContain('notes');
  });
});
