import { formatGrosze, nextStatuses } from '@/lib/api/orders';

describe('nextStatuses', () => {
  it('offers only the legal moves out of a live order', () => {
    expect(nextStatuses('PENDING')).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(nextStatuses('PROCESSING')).toEqual(['DELIVERED', 'CANCELLED']);
  });

  it('offers nothing out of a terminal state', () => {
    expect(nextStatuses('DELIVERED')).toEqual([]);
    expect(nextStatuses('CANCELLED')).toEqual([]);
  });
});

describe('formatGrosze', () => {
  it('renders integer grosze as Polish złote', () => {
    // Intl puts a (narrow) no-break space before the currency.
    expect(formatGrosze(45000, 'pl').replace(/\s/g, ' ')).toBe('450,00 zł');
  });
});
