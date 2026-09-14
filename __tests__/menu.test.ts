import {
  ALLERGENS,
  MENU_COURSES,
  groupByCourse,
  nextSortOrder,
  parseTags,
  parseWholeNumber,
  reorderWithinCourse,
  type AdminMenuItem,
  type MenuCourse,
} from '@/lib/api/menu';
import en from '@/messages/en.json';
import pl from '@/messages/pl.json';

function dish(id: string, course: MenuCourse, sortOrder: number, namePl = id): AdminMenuItem {
  return {
    id,
    course,
    namePl,
    nameEn: namePl,
    descriptionPl: null,
    descriptionEn: null,
    mealId: null,
    kcal: null,
    proteinG: null,
    fatG: null,
    carbsG: null,
    allergens: [],
    tags: [],
    sortOrder,
    isActive: true,
  };
}

describe('menu contract', () => {
  it('spells the enums exactly as pinned in bobr-backend#28', () => {
    expect(MENU_COURSES).toEqual(['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']);
    expect(ALLERGENS).toHaveLength(14);
    expect(ALLERGENS[0]).toBe('GLUTEN');
    expect(ALLERGENS[13]).toBe('MOLLUSCS');
  });

  it('has a Polish and an English label for every course and allergen', () => {
    for (const messages of [pl, en]) {
      for (const course of MENU_COURSES) expect(messages.menuPage.courses[course]).toBeTruthy();
      for (const allergen of ALLERGENS) {
        expect(messages.menuPage.allergens[allergen]).toBeTruthy();
      }
    }
  });

  it('words every error code the menu API emits, in both locales, with its params', () => {
    const codes: Record<string, string[]> = {
      MENU_ITEM_NOT_FOUND: [],
      DOCUMENT_FORMAT_UNSUPPORTED: ['{format}'],
      DOCUMENT_TOO_LARGE: ['{maxMb}'],
      IMAGE_FORMAT_UNSUPPORTED: ['{format}'],
      MEAL_NOT_FOUND: [],
      PAYLOAD_TOO_LARGE: [],
    };
    for (const messages of [pl, en]) {
      const wording = messages.apiErrors.codes as Record<string, string>;
      for (const [code, params] of Object.entries(codes)) {
        expect(wording[code]).toBeTruthy();
        for (const param of params) expect(wording[code]).toContain(param);
      }
      expect(messages.apiErrors.fields.mealId).toBeTruthy();
    }
  });
});

describe('groupByCourse', () => {
  it('returns every course in eating order, each sorted by sortOrder', () => {
    const groups = groupByCourse([
      dish('d', 'DINNER', 0),
      dish('b2', 'BREAKFAST', 2),
      dish('b1', 'BREAKFAST', 1),
    ]);
    expect(groups.map((group) => group.course)).toEqual([...MENU_COURSES]);
    expect(groups[0].items.map((item) => item.id)).toEqual(['b1', 'b2']);
    expect(groups[2].items).toEqual([]);
    expect(groups[4].items.map((item) => item.id)).toEqual(['d']);
  });

  it('breaks sortOrder ties by Polish name so the list is stable', () => {
    const groups = groupByCourse([
      dish('z', 'LUNCH', 0, 'Żurek'),
      dish('a', 'LUNCH', 0, 'Barszcz'),
    ]);
    expect(groups[2].items.map((item) => item.id)).toEqual(['a', 'z']);
  });
});

describe('nextSortOrder', () => {
  it('places a new dish after the last one in its course', () => {
    const items = [dish('a', 'LUNCH', 3), dish('b', 'LUNCH', 7), dish('c', 'DINNER', 20)];
    expect(nextSortOrder(items, 'LUNCH')).toBe(8);
    expect(nextSortOrder(items, 'SNACK')).toBe(0);
  });
});

describe('reorderWithinCourse', () => {
  const items = [
    dish('a', 'BREAKFAST', 0),
    dish('b', 'BREAKFAST', 1),
    dish('c', 'BREAKFAST', 2),
    dish('x', 'LUNCH', 0),
  ];

  it('swaps a dish with its neighbour and sends only what changed', () => {
    expect(reorderWithinCourse(items, 'b', 'up')).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
    ]);
    expect(reorderWithinCourse(items, 'b', 'down')).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });

  it('does nothing past either end of the course', () => {
    expect(reorderWithinCourse(items, 'a', 'up')).toEqual([]);
    expect(reorderWithinCourse(items, 'c', 'down')).toEqual([]);
    expect(reorderWithinCourse(items, 'x', 'up')).toEqual([]);
    expect(reorderWithinCourse(items, 'missing', 'up')).toEqual([]);
  });

  it('renumbers a course whose dishes all share the default 0', () => {
    const tied = [dish('a', 'SNACK', 0, 'A'), dish('b', 'SNACK', 0, 'B'), dish('c', 'SNACK', 0, 'C')];
    expect(reorderWithinCourse(tied, 'c', 'up')).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });
});

describe('parseWholeNumber', () => {
  it('accepts whole numbers and empty, refuses fractions and junk', () => {
    expect(parseWholeNumber('')).toBeNull();
    expect(parseWholeNumber('  ')).toBeNull();
    expect(parseWholeNumber('420')).toBe(420);
    expect(parseWholeNumber(' 0 ')).toBe(0);
    expect(parseWholeNumber('12.5')).toBeUndefined();
    expect(parseWholeNumber('12,5')).toBeUndefined();
    expect(parseWholeNumber('-3')).toBeUndefined();
    expect(parseWholeNumber('1e3')).toBeUndefined();
    expect(parseWholeNumber('123456')).toBeUndefined();
  });
});

describe('parseTags', () => {
  it('splits, trims, collapses spaces and drops case-insensitive duplicates', () => {
    expect(parseTags('wegańskie,  bez   cukru , , Wegańskie;ŻUREK\nżurek')).toEqual([
      'wegańskie',
      'bez cukru',
      'ŻUREK',
    ]);
    expect(parseTags('')).toEqual([]);
  });
});
