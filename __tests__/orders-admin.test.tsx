import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OrdersClient } from '@/app/[locale]/dashboard/orders/OrdersClient';
import type { AdminOrder } from '@/lib/api/orders';

/**
 * Issue #51 — staff cancel needs a reason, and the total can be adjusted.
 *
 * next-intl ships ESM only, so useTranslations is a lookup into the real
 * Polish messages (see settings-form.test.tsx); a missing key throws.
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

/**
 * Opening Radix's DropdownMenu spins jsdom (positioning never settles), so the
 * status menu is stubbed: items render inline and a click calls onSelect. The
 * dialogs, which are what this file tests, stay real.
 */
jest.mock('@/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuItem: ({
      children,
      onSelect,
      ...rest
    }: {
      children?: React.ReactNode;
      onSelect?: () => void;
      variant?: string;
      'data-testid'?: string;
    }) => (
      <button type="button" data-testid={rest['data-testid']} onClick={() => onSelect?.()}>
        {children}
      </button>
    ),
  };
});

function order(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: 'o1',
    mode: 'ONE_TIME',
    status: 'PENDING',
    paymentMethod: 'COD',
    unitPriceGrosze: 4500,
    goodsGrosze: 22500,
    discountPercent: 0,
    discountGrosze: 0,
    shippingGrosze: 0,
    totalGrosze: 22500,
    createdAt: '2026-09-20T10:00:00.000Z',
    days: [],
    meal: { namePl: 'Keto', nameEn: 'Keto', type: 'KETOGENIC' },
    delivery: null,
    user: { id: 'u1', email: 'jan@example.com', fullName: 'Jan Kowalski' },
    paidAt: null,
    paidGrosze: 0,
    adjustedTotalGrosze: null,
    totalAdjustment: null,
    ...overrides,
  };
}

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
/** Replies queued per "METHOD /path-suffix"; a GET of the list falls back to `listRows`. */
let replies: Array<{ match: string; status: number; body: unknown }> = [];
let listRows: AdminOrder[] = [];

beforeEach(() => {
  calls = [];
  replies = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const i = replies.findIndex((r) => `${method} ${url}`.endsWith(r.match));
    const next =
      i >= 0 ? replies.splice(i, 1)[0] : { status: 200, body: method === 'GET' ? listRows : {} };
    return { status: next.status, ok: next.status < 300, json: async () => next.body };
  }) as unknown as typeof fetch;
});

const patches = () => calls.filter((c) => c.method === 'PATCH');
const money = (text: string | null | undefined) => (text ?? '').replace(/\s/g, ' ');

/** The stubbed menu renders its items inline; choosing one fires onSelect. */
async function chooseMove(status: string) {
  fireEvent.click(await screen.findByTestId(`move-${status}`));
}

async function openCancel() {
  await chooseMove('CANCELLED');
  return screen.findByTestId('cancel-dialog');
}

describe('OrdersClient: cancel with a reason', () => {
  it('blocks the cancel until a reason of 3+ characters is given', async () => {
    listRows = [order()];
    const user = userEvent.setup();
    render(<OrdersClient />);

    const dialog = await openCancel();
    const confirm = within(dialog).getByTestId('confirm-cancel');
    expect(confirm).toBeDisabled();
    await user.click(confirm);

    await user.type(within(dialog).getByTestId('cancel-reason-input'), '  a ');
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByTestId('cancel-reason-count')).toHaveTextContent('4/500');
    expect(patches()).toHaveLength(0);
  });

  it('sends status CANCELLED with the reason and shows it on the row', async () => {
    listRows = [order()];
    replies.push({
      match: 'PATCH http://localhost:8003/v1/orders/admin/o1/status',
      status: 200,
      body: {
        ...order(),
        status: 'CANCELLED',
        cancelReason: 'Klient zrezygnował',
        cancelledAt: '2026-09-21T09:00:00.000Z',
        adjustedTotalGrosze: 0,
        user: undefined,
      },
    });
    const user = userEvent.setup();
    render(<OrdersClient />);

    const dialog = await openCancel();
    await user.type(within(dialog).getByTestId('cancel-reason-input'), ' Klient zrezygnował ');
    await user.click(within(dialog).getByTestId('confirm-cancel'));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0].url).toMatch(/\/v1\/orders\/admin\/o1\/status$/);
    expect(patches()[0].body).toEqual({ status: 'CANCELLED', cancelReason: 'Klient zrezygnował' });

    const info = await screen.findByTestId('cancel-info');
    expect(info).toHaveTextContent('Powód: Klient zrezygnował');
    expect(info).toHaveTextContent('Anulowano');
    // The list's included customer is kept even though the PATCH row lacks it.
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    // A cancelled order offers no adjustment.
    expect(screen.queryByTestId('adjust-total')).not.toBeInTheDocument();
  });

  it('does not send a reason for other transitions', async () => {
    listRows = [order()];
    replies.push({
      match: 'PATCH http://localhost:8003/v1/orders/admin/o1/status',
      status: 200,
      body: { ...order(), status: 'CONFIRMED' },
    });
    render(<OrdersClient />);

    await chooseMove('CONFIRMED');
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0].body).toEqual({ status: 'CONFIRMED' });
  });

  it('reloads the row on 409 ORDER_CHANGED', async () => {
    listRows = [order()];
    const user = userEvent.setup();
    render(<OrdersClient />);
    const dialog = await openCancel();

    replies.push({
      match: 'PATCH http://localhost:8003/v1/orders/admin/o1/status',
      status: 409,
      body: { statusCode: 409, message: 'changed', error: 'Conflict', code: 'ORDER_CHANGED' },
    });
    listRows = [order({ status: 'CONFIRMED' })];
    await user.type(within(dialog).getByTestId('cancel-reason-input'), 'Duplikat');
    await user.click(within(dialog).getByTestId('confirm-cancel'));

    expect(await screen.findByTestId('order-notice')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2);
    expect(screen.getByTestId('order-status')).toHaveTextContent('Potwierdzone');
  });
});

describe('OrdersClient: adjust the total', () => {
  it('converts "30,00" to 3000 grosze and shows the adjusted total', async () => {
    listRows = [order()];
    replies.push({
      match: 'PATCH http://localhost:8003/v1/orders/admin/o1/total',
      status: 200,
      body: {
        ...order(),
        adjustedTotalGrosze: 3000,
        totalAdjustment: { note: 'Rabat', adjustedById: 'a1', adjustedAt: '2026-09-21T09:00:00.000Z' },
      },
    });
    const user = userEvent.setup();
    render(<OrdersClient />);

    await user.click(await screen.findByTestId('adjust-total'));
    const dialog = await screen.findByTestId('adjust-dialog');
    await user.type(within(dialog).getByTestId('adjust-amount-input'), '30,00');
    await user.type(within(dialog).getByTestId('adjust-note-input'), 'Rabat');
    await user.click(within(dialog).getByTestId('submit-adjust'));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0].url).toMatch(/\/v1\/orders\/admin\/o1\/total$/);
    expect(patches()[0].body).toEqual({ adjustedTotalGrosze: 3000, note: 'Rabat' });
    expect(Number.isInteger((patches()[0].body as { adjustedTotalGrosze: number }).adjustedTotalGrosze)).toBe(true);

    expect(money((await screen.findByTestId('adjusted-total')).textContent)).toContain('30,00 zł');
    expect(screen.getByTestId('total-adjustment')).toHaveTextContent('Notatka: Rabat');
  });

  it('refuses an amount that is not złote without sending anything', async () => {
    listRows = [order()];
    const user = userEvent.setup();
    render(<OrdersClient />);
    await user.click(await screen.findByTestId('adjust-total'));
    const dialog = await screen.findByTestId('adjust-dialog');
    await user.type(within(dialog).getByTestId('adjust-amount-input'), '30,005');
    await user.click(within(dialog).getByTestId('submit-adjust'));
    expect(await within(dialog).findByText('Podaj poprawną kwotę, np. 45,00.')).toBeInTheDocument();
    expect(patches()).toHaveLength(0);
  });

  it('clear sends null', async () => {
    listRows = [order({ adjustedTotalGrosze: 3000 })];
    replies.push({
      match: 'PATCH http://localhost:8003/v1/orders/admin/o1/total',
      status: 200,
      body: { ...order(), adjustedTotalGrosze: null },
    });
    const user = userEvent.setup();
    render(<OrdersClient />);

    await user.click(await screen.findByTestId('adjust-total'));
    const dialog = await screen.findByTestId('adjust-dialog');
    await user.click(within(dialog).getByTestId('clear-adjustment'));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0].body).toEqual({ adjustedTotalGrosze: null });
    await waitFor(() => expect(screen.queryByTestId('adjusted-total')).not.toBeInTheDocument());
  });

  it('"X of Y paid" uses the adjusted total, and a paid order cannot be adjusted', async () => {
    listRows = [
      order({ id: 'o1', adjustedTotalGrosze: 3000, paidGrosze: 1000 }),
      order({ id: 'o2', paidAt: '2026-09-21T09:00:00.000Z', paidGrosze: 22500 }),
    ];
    render(<OrdersClient />);
    const part = await screen.findByTestId('part-paid');
    expect(money(part.textContent)).toBe('Wpłacono 10,00 zł z 30,00 zł');
    expect(screen.getAllByTestId('adjust-total')).toHaveLength(1);
  });
});
