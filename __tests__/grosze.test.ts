import { formatGrosze, groszeToZloteInput, zloteToGrosze } from '@/lib/api/orders';

/**
 * The COD payment dialog (gap G18) and the meal price field both parse złote
 * typed by a human into integer grosze with `zloteToGrosze` — never
 * `parseFloat(x) * 100`, which drifts for values like "45.10". These cases are
 * the ones a cashier actually types.
 */
describe('zloteToGrosze', () => {
  it('parses a whole number of złote', () => {
    expect(zloteToGrosze('45')).toBe(4500);
    expect(zloteToGrosze('0')).toBe(0);
  });

  it('parses two decimal places exactly, comma or dot', () => {
    expect(zloteToGrosze('45.10')).toBe(4510);
    expect(zloteToGrosze('45,10')).toBe(4510);
    expect(zloteToGrosze('199.99')).toBe(19999);
  });

  it('pads a single decimal place', () => {
    expect(zloteToGrosze('45.1')).toBe(4510);
  });

  it('tolerates surrounding whitespace', () => {
    expect(zloteToGrosze('  45.00  ')).toBe(4500);
  });

  it('refuses more than two decimal places, a bare decimal point, or non-numeric input', () => {
    expect(zloteToGrosze('45.999')).toBeNull();
    expect(zloteToGrosze('45.')).toBeNull();
    expect(zloteToGrosze('abc')).toBeNull();
    expect(zloteToGrosze('')).toBeNull();
    expect(zloteToGrosze('-5')).toBeNull();
  });

  it('never returns a float — the classic parseFloat(x)*100 bug', () => {
    // parseFloat('45.10') * 100 gives 4509.999999999999; integer arithmetic
    // on the whole/fraction parts must land on exactly 4510.
    expect(zloteToGrosze('45.10')).toBe(4510);
    expect(Number.isInteger(zloteToGrosze('45.10'))).toBe(true);
  });
});

describe('groszeToZloteInput', () => {
  it('is the inverse of zloteToGrosze for whole and fractional grosze', () => {
    expect(groszeToZloteInput(4500)).toBe('45.00');
    expect(groszeToZloteInput(4510)).toBe('45.10');
    expect(groszeToZloteInput(1)).toBe('0.01');
    expect(groszeToZloteInput(0)).toBe('0.00');
  });
});

describe('formatGrosze', () => {
  it('renders integer grosze as Polish złote', () => {
    // Intl puts a (narrow) no-break space before the currency.
    expect(formatGrosze(45000, 'pl').replace(/\s/g, ' ')).toBe('450,00 zł');
  });
});
