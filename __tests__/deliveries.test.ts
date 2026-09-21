import { warsawTodayIso, warsawTomorrowIso } from '@/lib/api/deliveries';

/*
 * The legal delivery-day moves are no longer copied here: each stop carries
 * the backend's `allowedNext` (ebneely/bobr-backend#67), covered in
 * deliveries-admin.test.tsx.
 */
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

  it('rolls over the year in Warsaw', () => {
    // 23:30 UTC on 31 Dec is 00:30 on 1 Jan in Warsaw (CET, UTC+1).
    expect(warsawTomorrowIso(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-02');
    expect(warsawTomorrowIso(new Date('2026-12-31T12:00:00Z'))).toBe('2027-01-01');
  });

  it('gives the next calendar day across the DST changes', () => {
    // The night the clocks go forward (29 Mar 2026) and back (25 Oct 2026).
    expect(warsawTomorrowIso(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-30');
    expect(warsawTomorrowIso(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-26');
    expect(warsawTomorrowIso(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-26');
  });
});
