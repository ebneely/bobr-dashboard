import '@testing-library/jest-dom';

// jsdom implements neither observer, and any component importing a hook that
// uses one crashes at module load without these.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const g = globalThis as unknown as Record<string, unknown>;
g.IntersectionObserver ??= NoopObserver;
g.ResizeObserver ??= NoopObserver;

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Why an opened Radix DropdownMenu "hung" jsdom tests (bobr-dashboard#52):
// its popper (floating-ui) asks each ancestor `matches(':modal')` and
// `matches(':popover-open')` (its top-layer check) every time it measures.
// jsdom's selector engine (nwsapi) answers those two pseudo-classes extremely
// slowly — a CPU profile put ~13 s of a 15 s menu-open inside them, long enough
// to look like a hang and trip every test timeout. Nothing in jsdom is ever in
// the top layer, so answer false directly and leave every other selector alone.
if (typeof document !== 'undefined') {
  const nativeMatches = Element.prototype.matches;
  Element.prototype.matches = function matches(this: Element, selectors: string) {
    if (selectors === ':modal' || selectors === ':popover-open') return false;
    return nativeMatches.call(this, selectors);
  };
}
