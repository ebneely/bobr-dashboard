import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MealsClient } from '@/app/[locale]/dashboard/meals/MealsClient';
import type { AdminMeal } from '@/lib/api/orders';

/** Issue #51 — the meal's VAT rate is a Select of 0/5/8/23 sent as a number. */
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

// Radix Select measures and captures pointers; jsdom implements neither.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

const MEAL: AdminMeal = {
  id: 'm1',
  type: 'KETOGENIC',
  namePl: 'Keto',
  nameEn: 'Keto',
  descriptionPl: null,
  descriptionEn: null,
  priceGrosze: 4500,
  isActive: true,
  imageKey: null,
  allergens: [],
  kcal: null,
  vatRatePercent: 23,
};

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];

beforeEach(() => {
  calls = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = method === 'GET' ? [MEAL] : { ...MEAL, ...(body as object) };
    return { status: 200, ok: true, json: async () => reply };
  }) as unknown as typeof fetch;
});

describe('MealsClient: VAT rate', () => {
  it('shows the current rate and sends the chosen one as a number', async () => {
    const user = userEvent.setup();
    render(<MealsClient />);

    expect(await screen.findByTestId('meal-vat')).toHaveTextContent('VAT 23%');
    await user.click(screen.getByRole('button', { name: 'Edytuj' }));

    const trigger = await screen.findByTestId('meal-vat-rate');
    expect(trigger).toHaveTextContent('23%');
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: '8%' }));
    expect(trigger).toHaveTextContent('8%');

    await user.click(screen.getByRole('button', { name: /^Zapisz/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toMatch(/\/v1\/meals\/admin\/m1$/);
    expect((patch.body as { vatRatePercent: unknown }).vatRatePercent).toBe(8);
  });

  it('defaults a new meal to 8%', async () => {
    const user = userEvent.setup();
    render(<MealsClient />);
    await user.click(await screen.findByTestId('new-meal'));
    expect(await screen.findByTestId('meal-vat-rate')).toHaveTextContent('8%');
  });
});
