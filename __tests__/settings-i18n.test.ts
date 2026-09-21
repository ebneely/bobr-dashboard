import type { SettingsSchema } from '@/lib/api/settings';
import { schemaMessageKeys } from '@/lib/settings/draft';
import en from '@/messages/en.json';
import pl from '@/messages/pl.json';

import schemaFixture from './fixtures/settings-schema.json';

/**
 * The settings page renders whatever the backend registry lists, and every
 * word of it comes from `settings.*` here. This is the gate that turns "a new
 * registry key without copy" into a red CI run instead of a raw key on screen.
 *
 * The fixture is `GET /v1/settings/admin/schema` from the backend (WP1 of
 * ebneely/bobr-backend#57). When the registry grows, refresh it:
 *   curl -b <admin cookie> http://localhost:8003/v1/settings/admin/schema
 */
const schema = schemaFixture as unknown as SettingsSchema;

function lookup(messages: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
}

function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key));
}

describe('settings copy', () => {
  const keys = schemaMessageKeys(schema);

  it('covers a schema with every control the registry uses', () => {
    const fields = schema.sections.flatMap((s) => s.fields);
    expect(fields.length).toBeGreaterThanOrEqual(23);
    expect(new Set(fields.map((f) => f.control))).toEqual(
      new Set(['money', 'localizedText', 'time', 'select', 'text', 'weekdays', 'number', 'list', 'toggle', 'image', 'textarea']),
    );
    // Sections, labels, helps, options and list columns are all collected.
    expect(keys).toEqual(
      expect.arrayContaining([
        'settings.sections.pricing',
        'settings.fields.discountTiers.label',
        'settings.fields.discountTiers.help',
        'settings.fields.discountTiers.minDays',
        'settings.options.consultationSlotStepMinutes.60',
        'settings.units.days',
      ]),
    );
  });

  it.each([
    ['pl', pl],
    ['en', en],
  ])('every key the schema references exists in messages/%s.json', (_lang, messages) => {
    const missing = keys.filter((key) => {
      const value = lookup(messages, key);
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(missing).toEqual([]);
  });

  it('every field has a label and help key', () => {
    for (const field of schema.sections.flatMap((s) => s.fields)) {
      expect(field.labelKey).toBe(`settings.fields.${field.key}.label`);
      expect(field.helpKey).toBe(`settings.fields.${field.key}.help`);
    }
  });

  it('pl and en carry exactly the same settings keys', () => {
    expect(leafKeys(en.settings).sort()).toEqual(leafKeys(pl.settings).sort());
  });

  it('the Polish copy is not the English copy', () => {
    // A quick guard against pasting one file into the other.
    const same = keys.filter((key) => lookup(pl, key) === lookup(en, key) && !/^settings\.units\./.test(key));
    expect(same).toEqual([]);
  });
});
