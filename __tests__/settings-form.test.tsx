import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SettingsForm } from '@/app/[locale]/dashboard/settings/SettingsForm';
import type { SettingsSchema } from '@/lib/api/settings';
import { buildPatch, fromDraft, toDraft } from '@/lib/settings/draft';

import schemaFixture from './fixtures/settings-schema.json';

/**
 * next-intl ships ESM only, which this Jest setup does not transform, so
 * useTranslations is stood in for by a lookup into the real Polish messages
 * (with simple {name} substitution) — a missing key throws instead of
 * rendering a key path.
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

const schema = schemaFixture as unknown as SettingsSchema;

const VALUES = {
  consultationPriceGrosze: 10000,
  doctorName: { pl: 'Dr Abdelrahman', en: 'Dr Abdelrahman' },
  consultationSlotStart: '08:00',
  consultationSlotEnd: '20:00',
  consultationSlotStepMinutes: 30,
  blikPhone: null,
  blikRecipientName: null,
  deliveryWeekdays: [1, 2, 3, 4, 5, 6],
  orderCutoffHour: null,
  leadDays: 2,
  orderWindowMonths: 1,
  changeCutoffDays: 2,
  calendarMinDays: 5,
  oneTimeDayCount: 1,
  intakeMaxAgeDays: null,
  discountTiers: [
    { minDays: 10, percent: 10 },
    { minDays: 20, percent: 15 },
  ],
  wholeMonthPercent: 20,
  calendarFreeShipping: true,
  heroImage: null,
  contactEmail: 'kontakt@bobr.pl',
  contactPhone: null,
  contactAddress: null,
  footerTagline: { pl: 'Katering dietetyczny z dostawą.', en: 'Diet catering, delivered.' },
};

type Reply = { status: number; body: unknown };
const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit]>();

/** Answers each fetch with the next reply; a 200 echoes the PATCH merged into VALUES. */
function reply(...replies: Reply[]) {
  for (const next of replies) {
    fetchMock.mockImplementationOnce(async (_url, init) => {
      const body =
        next.status === 200 && next.body === 'echo'
          ? { values: { ...VALUES, ...JSON.parse(String(init.body)) }, updatedAt: '2026-09-21T12:00:00.000Z' }
          : next.body;
      return { status: next.status, ok: next.status < 300, json: async () => body };
    });
  }
}

function patchBodies(): unknown[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([, init]) => JSON.parse(String(init.body)));
}

function unprocessable(...message: { field: string; issue: string; code: string; params?: Record<string, number> }[]) {
  return {
    status: 422,
    body: { statusCode: 422, message, error: 'Unprocessable Entity', code: 'VALIDATION_FAILED' },
  };
}

function renderForm(initialTab?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['settings', 'admin', 'values'], { values: VALUES, updatedAt: 'x' });
  return render(
    <QueryClientProvider client={client}>
      <SettingsForm schema={schema} values={VALUES} initialTab={initialTab} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('SettingsForm (generated from the registry schema)', () => {
  it('renders one tab per schema section, in order, plus closed days', () => {
    renderForm();
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Konsultacje', 'Płatności', 'Dostawy', 'Zamówienia', 'Ceny i rabaty', 'Strona', 'Dni wolne']);
    // enforced:false shows the hint; the enforced price does not.
    const price = screen.getByTestId('setting-consultationPriceGrosze');
    expect(within(price).queryByText('Jeszcze nie działa')).toBeNull();
    expect(within(screen.getByTestId('setting-doctorName')).getByText('Jeszcze nie działa')).toBeInTheDocument();
  });

  it('money typed as "120,50" is PATCHed as 12050 grosze, and only that key', async () => {
    const user = userEvent.setup();
    reply({ status: 200, body: 'echo' });
    renderForm();

    const price = screen.getByLabelText('Cena konsultacji');
    expect(price).toHaveValue('100,00');
    expect(screen.getByTestId('settings-save-consultations')).toBeDisabled();

    await user.clear(price);
    await user.type(price, '120,50');
    await user.click(screen.getByTestId('settings-save-consultations'));

    await waitFor(() => expect(patchBodies()).toEqual([{ consultationPriceGrosze: 12050 }]));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/settings\/admin$/);
    expect(init.method).toBe('PATCH');
    expect(Number.isInteger((patchBodies()[0] as { consultationPriceGrosze: number }).consultationPriceGrosze)).toBe(true);
  });

  it('refuses an unparseable amount before sending anything', async () => {
    const user = userEvent.setup();
    renderForm();
    const price = screen.getByLabelText('Cena konsultacji');
    await user.clear(price);
    await user.type(price, '12,345');
    await user.click(screen.getByTestId('settings-save-consultations'));

    expect(
      within(screen.getByTestId('setting-consultationPriceGrosze')).getByText('Podaj kwotę w złotych, np. 120,50.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('puts each 422 issue under its own field — key, key.pl and a cross-field rule', async () => {
    const user = userEvent.setup();
    reply(
      unprocessable(
        { field: 'consultationSlotEnd', issue: 'The last slot must be later than the first', code: 'SETTING_SLOT_RANGE' },
        { field: 'doctorName.pl', issue: 'too short', code: 'TOO_SHORT', params: { minimum: 1 } },
        { field: 'consultationPriceGrosze', issue: 'too big', code: 'TOO_BIG', params: { maximum: 1000000 } },
      ),
    );
    renderForm();

    fireEvent.change(screen.getByLabelText('Pierwszy termin w ciągu dnia'), { target: { value: '21:00' } });
    await user.click(screen.getByTestId('settings-save-consultations'));

    const end = await screen.findByText('Ostatni termin musi być późniejszy niż pierwszy.');
    expect(screen.getByTestId('setting-consultationSlotEnd')).toContainElement(end);
    expect(within(screen.getByTestId('setting-consultationSlotStart')).queryByRole('alert')).toBeNull();

    // localizedText: under the Polish input, not the English one.
    const plInput = screen.getByLabelText('Po polsku');
    expect(plInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Po angielsku')).not.toHaveAttribute('aria-invalid');

    // A money limit is shown in złoty, not raw grosze.
    const priceError = within(screen.getByTestId('setting-consultationPriceGrosze')).getByRole('alert');
    expect(priceError.textContent).toMatch(/10\s?000,00\s?zł/);

    expect(patchBodies()).toEqual([{ consultationSlotStart: '21:00' }]);
  });

  it('weekday toggles send ISO days 1–7, sorted', async () => {
    const user = userEvent.setup();
    reply({ status: 200, body: 'echo' });
    renderForm('delivery');

    expect(screen.getByTestId('weekday-1')).toHaveAttribute('data-state', 'on');
    expect(screen.getByTestId('weekday-7')).toHaveAttribute('data-state', 'off');
    expect(screen.getByTestId('weekday-1')).toHaveAccessibleName('poniedziałek');

    await user.click(screen.getByTestId('weekday-7'));
    await user.click(screen.getByTestId('weekday-1'));
    expect(screen.getByTestId('weekday-7')).toHaveAttribute('data-state', 'on');

    await user.click(screen.getByTestId('settings-save-delivery'));
    await waitFor(() => expect(patchBodies()).toEqual([{ deliveryWeekdays: [2, 3, 4, 5, 6, 7] }]));
  });

  it('discount tiers: add a row, see a duplicate inline, fix it, save sorted; remove a row', async () => {
    const user = userEvent.setup();
    reply({ status: 200, body: 'echo' }, { status: 200, body: 'echo' });
    renderForm('pricing');

    expect(screen.getAllByTestId('setting-discountTiers-row')).toHaveLength(2);
    await user.click(screen.getByTestId('setting-discountTiers-add'));
    expect(screen.getAllByTestId('setting-discountTiers-row')).toHaveLength(3);

    const minDays = screen.getByLabelText('Od liczby dni', { selector: '#setting-discountTiers-2-minDays' });
    await user.type(minDays, '10');
    expect(screen.getByText('Ta wartość powtarza się w innym wierszu.')).toBeInTheDocument();

    await user.clear(minDays);
    await user.type(minDays, '5');
    await user.type(screen.getByLabelText('Rabat', { selector: '#setting-discountTiers-2-percent' }), '5');
    expect(screen.queryByText('Ta wartość powtarza się w innym wierszu.')).toBeNull();
    expect(screen.getByTestId('setting-discountTiers-unsorted')).toBeInTheDocument();

    await user.click(screen.getByTestId('settings-save-pricing'));
    await waitFor(() =>
      expect(patchBodies()[0]).toEqual({
        discountTiers: [
          { minDays: 5, percent: 5 },
          { minDays: 10, percent: 10 },
          { minDays: 20, percent: 15 },
        ],
      }),
    );

    // After the save the form shows what the server stored (sorted).
    await waitFor(() => expect(screen.getByTestId('settings-save-pricing')).toHaveTextContent('Zapisz'));
    await user.click(screen.getAllByTestId('setting-discountTiers-remove')[0]);
    expect(screen.getAllByTestId('setting-discountTiers-row')).toHaveLength(2);
  });

  it('a 422 inside a list lands on the row and column it names', async () => {
    const user = userEvent.setup();
    reply(unprocessable({ field: 'discountTiers.1.percent', issue: 'too big', code: 'TOO_BIG', params: { maximum: 100 } }));
    renderForm('pricing');

    const percent = screen.getByLabelText('Rabat', { selector: '#setting-discountTiers-1-percent' });
    await user.clear(percent);
    await user.type(percent, '99');
    await user.click(screen.getByTestId('settings-save-pricing'));

    await waitFor(() => expect(percent).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('Wartość może wynosić najwyżej 100.')).toBeInTheDocument();
    expect(screen.getByLabelText('Rabat', { selector: '#setting-discountTiers-0-percent' })).not.toHaveAttribute(
      'aria-invalid',
    );
  });

  it('new server values reach untouched fields; an edit in progress is kept', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();
    const view = (values: typeof VALUES) => (
      <QueryClientProvider client={client}>
        <SettingsForm schema={schema} values={values} initialTab="ordering" />
      </QueryClientProvider>
    );
    const { rerender } = render(view(VALUES));
    await user.clear(screen.getByLabelText('Liczba dni zamówienia jednorazowego'));
    await user.type(screen.getByLabelText('Liczba dni zamówienia jednorazowego'), '3');

    // Another admin changed calendarMinDays and oneTimeDayCount meanwhile.
    rerender(view({ ...VALUES, calendarMinDays: 6, oneTimeDayCount: 2 }));

    expect(screen.getByLabelText('Minimalna liczba dni w kalendarzu')).toHaveValue('6');
    expect(screen.getByLabelText('Liczba dni zamówienia jednorazowego')).toHaveValue('3');
    expect(screen.getByTestId('settings-tab-pricing')).toHaveTextContent(/^Ceny i rabaty$/);
  });

  it('Reset puts the section back to the stored values', async () => {
    const user = userEvent.setup();
    renderForm('ordering');
    const minDays = screen.getByLabelText('Minimalna liczba dni w kalendarzu');
    await user.clear(minDays);
    await user.type(minDays, '9');
    expect(screen.getByTestId('settings-reset-ordering')).toBeEnabled();
    await user.click(screen.getByTestId('settings-reset-ordering'));
    expect(minDays).toHaveValue('5');
    expect(screen.getByTestId('settings-save-ordering')).toBeDisabled();
  });
});

describe('draft ↔ wire', () => {
  const field = (key: string) => schema.sections.flatMap((s) => s.fields).find((f) => f.key === key)!;

  it('money: a comma or a dot, never a float', () => {
    const price = field('consultationPriceGrosze');
    expect(fromDraft(price, '120,5')).toEqual({ ok: true, value: 12050 });
    expect(fromDraft(price, '120.50')).toEqual({ ok: true, value: 12050 });
    expect(fromDraft(price, '0,1')).toEqual({ ok: true, value: 10 });
    expect(fromDraft(price, 'abc').ok).toBe(false);
    expect(toDraft(price, 12050, 'pl')).toBe('120,50');
    expect(toDraft(price, 12050, 'en')).toBe('120.50');
  });

  it('nullable number: empty is null; non-nullable empty is REQUIRED', () => {
    expect(fromDraft(field('orderCutoffHour'), '')).toEqual({ ok: true, value: null });
    expect(fromDraft(field('leadDays'), '')).toEqual({ ok: false, issues: { '': { code: 'REQUIRED' } } });
    expect(fromDraft(field('leadDays'), '31')).toEqual({
      ok: false,
      issues: { '': { code: 'TOO_BIG', params: { maximum: 30 } } },
    });
  });

  it('time: 24h HH:mm, a single-digit hour padded, anything else refused', () => {
    expect(fromDraft(field('consultationSlotStart'), '8:30')).toEqual({ ok: true, value: '08:30' });
    expect(fromDraft(field('consultationSlotStart'), '24:00')).toEqual({
      ok: false,
      issues: { '': { code: 'SETTING_TIME_FORMAT' } },
    });
  });

  it('select keeps the option value type', () => {
    expect(fromDraft(field('consultationSlotStepMinutes'), '60')).toEqual({ ok: true, value: 60 });
  });

  it('buildPatch sends only what changed', () => {
    const fields = schema.sections.find((s) => s.id === 'site')!.fields;
    const drafts = Object.fromEntries(fields.map((f) => [f.key, toDraft(f, VALUES[f.key as keyof typeof VALUES], 'pl')]));
    drafts.contactPhone = '+48 600 123 456';
    expect(buildPatch(fields, drafts, VALUES)).toEqual({ ok: true, patch: { contactPhone: '+48 600 123 456' } });
  });
});
