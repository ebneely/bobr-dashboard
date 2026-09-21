import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConfirmConsultationDialog } from '@/app/[locale]/dashboard/consultations/ConfirmConsultationDialog';
import { matchesMeetUrlPattern, type AdminConsultation } from '@/lib/api/consultations';
import pl from '@/messages/pl.json';

/**
 * The confirm dialog validates the Meet link inline against the pattern the
 * backend sends on the row (`meetUrlPattern`, ebneely/bobr-backend#67) — no
 * client copy of the regex. The backend validates again either way.
 */
jest.mock('next-intl', () => {
  const messages = jest.requireActual('../messages/pl.json');
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
  const translator = (namespace?: string) => {
    const full = (key: string) => (namespace ? `${namespace}.${key}` : key);
    return Object.assign(
      (key: string, params?: Record<string, string | number>) => {
        const value = lookup(full(key));
        if (typeof value !== 'string') throw new Error(`missing message ${full(key)}`);
        return value.replace(/\{(\w+)\}/g, (match, name: string) =>
          params && name in params ? String(params[name]) : match,
        );
      },
      { has: (key: string) => typeof lookup(full(key)) === 'string' },
    );
  };
  return { useTranslations: translator, useLocale: () => 'pl' };
});

// Radix Select captures pointers and scrolls; jsdom implements neither.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

/** What the backend sends today: MEET_URL_PATTERN.source. */
const BACKEND_PATTERN = '^https:\\/\\/meet\\.google\\.com\\/[a-z]{3}-[a-z]{4}-[a-z]{3}$';

function consultation(overrides: Partial<AdminConsultation> = {}): AdminConsultation {
  return {
    id: 'c1',
    context: 'BEFORE_PLAN',
    preferredAt: '2026-09-25T08:00:00.000Z',
    note: null,
    priceGrosze: 15000,
    status: 'REQUESTED',
    scheduledAt: null,
    meetUrl: null,
    confirmedAt: null,
    createdAt: '2026-09-20T10:00:00.000Z',
    paidAt: null,
    paymentReference: 'BOBR-C1',
    allowedNext: ['CONFIRMED', 'CANCELLED'],
    meetUrlPattern: BACKEND_PATTERN,
    customer: { name: 'Anna Nowak', email: 'anna@example.com' },
    ...overrides,
  };
}

let patches: Array<{ url: string; body: unknown }> = [];

beforeEach(() => {
  patches = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    if (init.method === 'PATCH') patches.push({ url, body });
    return {
      status: 200,
      ok: true,
      json: async () => ({ ...consultation(), status: 'CONFIRMED', allowedNext: ['COMPLETED', 'CANCELLED'] }),
    };
  }) as unknown as typeof fetch;
});

/** Fills a valid Warsaw slot and the given link, then presses Confirm. */
async function submitWith(row: AdminConsultation, meetUrl: string) {
  const user = userEvent.setup();
  const onConfirmed = jest.fn();
  render(
    <ConfirmConsultationDialog consultation={row} onOpenChange={() => {}} onConfirmed={onConfirmed} />,
  );
  fireEvent.change(screen.getByLabelText(pl.consultationsPage.date), {
    target: { value: '2030-01-15' },
  });
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: '10:00' }));
  await user.type(screen.getByLabelText(pl.consultationsPage.meetUrl), meetUrl);
  await user.click(screen.getByRole('button', { name: pl.consultationsPage.confirm }));
  return onConfirmed;
}

describe('ConfirmConsultationDialog: Meet link checked against row.meetUrlPattern', () => {
  it('refuses a link the row pattern rejects, without calling the API', async () => {
    await submitWith(consultation(), 'https://meet.google.com/ABC-defg-hij');
    expect(await screen.findByTestId('confirm-error')).toHaveTextContent(
      pl.consultationsPage.meetUrlInvalid,
    );
    expect(screen.getByLabelText(pl.consultationsPage.meetUrl)).toHaveAttribute('aria-invalid', 'true');
    expect(patches).toHaveLength(0);
  });

  it('sends a link the row pattern accepts', async () => {
    const onConfirmed = await submitWith(consultation(), ' https://meet.google.com/abc-defg-hij ');
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0].url).toMatch(/\/v1\/consultations\/admin\/c1\/confirm$/);
    expect(patches[0].body).toEqual({
      scheduledAt: '2030-01-15T09:00:00.000Z',
      meetUrl: 'https://meet.google.com/abc-defg-hij',
    });
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
  });

  it('follows whatever pattern the server sends, not a built-in one', async () => {
    // A (hypothetical) server pattern that no Meet link satisfies.
    const row = consultation({ meetUrlPattern: '^https:\\/\\/meet\\.example\\.test\\/[0-9]+$' });
    await submitWith(row, 'https://meet.google.com/abc-defg-hij');
    expect(await screen.findByTestId('confirm-error')).toHaveTextContent(
      pl.consultationsPage.meetUrlInvalid,
    );
    expect(patches).toHaveLength(0);
  });
});

describe('matchesMeetUrlPattern', () => {
  it('compiles the source without flags and trims the value', () => {
    expect(matchesMeetUrlPattern(' https://meet.google.com/abc-defg-hij ', BACKEND_PATTERN)).toBe(true);
    expect(matchesMeetUrlPattern('https://meet.google.com/abc-defg-hijk', BACKEND_PATTERN)).toBe(false);
    expect(matchesMeetUrlPattern('http://meet.google.com/abc-defg-hij', BACKEND_PATTERN)).toBe(false);
  });

  it('defers to the server check when the pattern does not compile', () => {
    expect(matchesMeetUrlPattern('anything', '([')).toBe(true);
  });
});
