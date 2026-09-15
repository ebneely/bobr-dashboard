import { isStaffRowActionable } from '@/lib/api/staff';
import { readinessGaps } from '@/lib/hooks/use-readiness';
import { stripLocale } from '@/lib/auth/urls';

describe('isStaffRowActionable', () => {
  it('offers actions on another ADMIN only', () => {
    expect(isStaffRowActionable({ id: 'a', role: 'ADMIN' }, 'me')).toBe(true);
    expect(isStaffRowActionable({ id: 'b', role: 'SUPER_ADMIN' }, 'me')).toBe(false);
    expect(isStaffRowActionable({ id: 'me', role: 'ADMIN' }, 'me')).toBe(false);
  });
});

describe('readinessGaps', () => {
  it('lists every known gap, in checklist order', () => {
    expect(readinessGaps({ activeMeals: 0, activeZones: 0, blikConfigured: false })).toEqual([
      'meals',
      'zones',
      'blik',
    ]);
  });

  it('says nothing when ready', () => {
    expect(readinessGaps({ activeMeals: 3, activeZones: 1, blikConfigured: true })).toEqual([]);
  });

  it('never raises an alarm for an unknown (loading or failed) check', () => {
    expect(readinessGaps({})).toEqual([]);
    expect(readinessGaps({ activeZones: 0 })).toEqual(['zones']);
  });
});

describe('stripLocale', () => {
  it('drops a known locale prefix only', () => {
    expect(stripLocale('/pl/dashboard/orders')).toBe('/dashboard/orders');
    expect(stripLocale('/en')).toBe('/');
    expect(stripLocale('/plx/dashboard')).toBe('/plx/dashboard');
  });
});
