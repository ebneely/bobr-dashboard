import {
  DAY_TRANSITIONS,
  warsawTodayIso,
  warsawTomorrowIso,
} from '@/lib/api/deliveries';

/**
 * A UI-side copy of the backend's legal delivery-day moves
 * (bobr_backend/src/deliveries/deliveries.service.ts `DAY_TRANSITIONS`) — the
 * deliveries screen must only OFFER a move the backend will actually accept.
 */
describe('DAY_TRANSITIONS', () => {
  it('lets a SCHEDULED day become DELIVERED, FAILED or CANCELLED', () => {
    expect(DAY_TRANSITIONS.SCHEDULED).toEqual(
      expect.arrayContaining(['DELIVERED', 'FAILED', 'CANCELLED']),
    );
  });

  it('lets a FAILED delivery be retried to DELIVERED, and nothing else', () => {
    expect(DAY_TRANSITIONS.FAILED).toEqual(['DELIVERED']);
  });

  it('treats DELIVERED, SKIPPED and CANCELLED as terminal', () => {
    expect(DAY_TRANSITIONS.DELIVERED).toEqual([]);
    expect(DAY_TRANSITIONS.SKIPPED).toEqual([]);
    expect(DAY_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe('warsaw date helpers', () => {
  it('computes tomorrow as exactly one day after today', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    expect(warsawTodayIso(now)).toBe('2026-06-15');
    expect(warsawTomorrowIso(now)).toBe('2026-06-16');
  });

  it('stays in Warsaw across a UTC midnight boundary', () => {
    // 23:30 UTC on 2026-06-15 is already 2026-06-16 in Warsaw (CEST, UTC+2).
    const now = new Date('2026-06-15T23:30:00Z');
    expect(warsawTodayIso(now)).toBe('2026-06-16');
    expect(warsawTomorrowIso(now)).toBe('2026-06-17');
  });
});
