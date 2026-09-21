import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DeliveriesClient } from '@/app/[locale]/dashboard/deliveries/DeliveriesClient';
import type { AdminDeliveriesView, DeliveryStop } from '@/lib/api/deliveries';
import pl from '@/messages/pl.json';

/** Each stop's actions come from its `allowedNext` (ebneely/bobr-backend#67). */
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

function stop(id: string, overrides: Partial<DeliveryStop> = {}): DeliveryStop {
  return {
    orderDayId: id,
    orderId: `o-${id}`,
    dayStatus: 'SCHEDULED',
    allowedNext: ['DELIVERED', 'FAILED', 'CANCELLED'],
    orderPending: false,
    mealType: 'KETOGENIC',
    mealNamePl: 'Keto',
    customerName: `Klient ${id}`,
    phone: null,
    addressLine: null,
    postalCode: null,
    city: null,
    zoneNamePl: null,
    deliveryNotes: null,
    allergens: [],
    codToCollectGrosze: null,
    paid: false,
    ...overrides,
  };
}

let view: AdminDeliveriesView;

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    status: 200,
    ok: true,
    json: async () => view,
  })) as unknown as typeof fetch;
});

async function stopRows() {
  const user = userEvent.setup();
  render(<DeliveriesClient />);
  await user.click(await screen.findByTestId('tab-couriers'));
  const rows = await screen.findAllByTestId('stop-row');
  return (id: string) => rows.find((r) => r.getAttribute('data-order-day-id') === id)!;
}

describe('DeliveriesClient: stop actions follow allowedNext', () => {
  it('offers deliver and fail only when the server allows them', async () => {
    view = {
      date: '2030-01-15',
      production: [],
      stops: [
        stop('open'),
        stop('failed', { dayStatus: 'FAILED', allowedNext: ['DELIVERED'] }),
        stop('done', { dayStatus: 'DELIVERED', allowedNext: [] }),
        // An order not yet CONFIRMED: the server drops DELIVERED and FAILED.
        stop('pending', { orderPending: true, allowedNext: ['CANCELLED'] }),
      ],
    };
    const row = await stopRows();

    expect(within(row('open')).getByTestId('mark-delivered')).toBeInTheDocument();
    expect(within(row('open')).getByTestId('mark-failed')).toBeInTheDocument();

    expect(within(row('failed')).getByTestId('mark-delivered')).toBeInTheDocument();
    expect(within(row('failed')).queryByTestId('mark-failed')).not.toBeInTheDocument();

    for (const id of ['done', 'pending']) {
      expect(within(row(id)).queryByTestId('mark-delivered')).not.toBeInTheDocument();
      expect(within(row(id)).queryByTestId('mark-failed')).not.toBeInTheDocument();
    }
    expect(within(row('pending')).getAllByText(pl.deliveriesPage.orderPending).length).toBeGreaterThan(0);
  });
});
