import { formatApiError } from '@/lib/api/client';

describe('formatApiError', () => {
  it('renders zod field issues as field: issue', () => {
    expect(
      formatApiError({
        statusCode: 400,
        message: [{ field: 'weightKg', issue: 'Required' }],
        error: 'Bad Request',
      }),
    ).toBe('weightKg: Required');
  });

  it('returns an empty string for a missing body', () => {
    expect(formatApiError(null)).toBe('');
  });
});
