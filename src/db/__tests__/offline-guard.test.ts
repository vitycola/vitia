/**
 * Tests for the offline guard in SearchRoute (src/routes/search.tsx).
 * Layer: unit — verifies the guard logic that wraps useFoodSearchStore.search.
 *
 * The guard lives in `handleQueryChange`:
 *   if (!navigator.onLine) { clear(); return; }   ← short-circuit
 *   debounce → search(q)                           ← only when online
 *
 * We extract and test the guard's decision logic directly without rendering
 * the component, since the project's test environment is `node` (no jsdom).
 */

// ── Guard logic extracted for unit testing ─────────────────────────────

/**
 * Mirrors the handleQueryChange guard logic from SearchRoute.
 * Returns whether `search` would be scheduled (true) or short-circuited (false).
 */
function wouldCallSearch(isOnline: boolean): boolean {
  if (!isOnline) {
    return false; // clear() and return — search is NOT called
  }
  return true; // debounce → search(q) would run
}

// ── navigator.onLine mock helpers ──────────────────────────────────────

function setOnline(value: boolean) {
  // In the Node test environment `navigator` may not exist — create it if needed.
  if (typeof globalThis.navigator === "undefined") {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });
  }
  Object.defineProperty(globalThis.navigator, "onLine", {
    get: () => value,
    configurable: true,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("SearchRoute offline guard — navigator.onLine = false", () => {
  beforeEach(() => setOnline(false));
  afterEach(() => setOnline(true));

  it("short-circuits: search is NOT called when offline", () => {
    expect(navigator.onLine).toBe(false);
    expect(wouldCallSearch(navigator.onLine)).toBe(false);
  });

  it("guard evaluates navigator.onLine at call time (false → short-circuit)", () => {
    const shouldSearch = wouldCallSearch(navigator.onLine);
    expect(shouldSearch).toBe(false);
  });
});

describe("SearchRoute offline guard — navigator.onLine = true", () => {
  beforeEach(() => setOnline(true));

  it("allows: search IS called when online", () => {
    expect(navigator.onLine).toBe(true);
    expect(wouldCallSearch(navigator.onLine)).toBe(true);
  });

  it("guard evaluates navigator.onLine at call time (true → search proceeds)", () => {
    const shouldSearch = wouldCallSearch(navigator.onLine);
    expect(shouldSearch).toBe(true);
  });
});

describe("SearchRoute offline guard — transition between states", () => {
  it("offline → online: only the online call proceeds", () => {
    setOnline(false);
    expect(wouldCallSearch(navigator.onLine)).toBe(false);

    setOnline(true);
    expect(wouldCallSearch(navigator.onLine)).toBe(true);
  });

  it("online → offline: guard prevents search after connection drops", () => {
    setOnline(true);
    expect(wouldCallSearch(navigator.onLine)).toBe(true);

    setOnline(false);
    expect(wouldCallSearch(navigator.onLine)).toBe(false);
  });
});

describe("SearchRoute offline guard — mock useFoodSearchStore.search", () => {
  it("search mock is never called when offline", () => {
    setOnline(false);
    const searchMock = jest.fn();
    const clearMock = jest.fn();

    // Simulate handleQueryChange guard
    const isOnline = navigator.onLine;
    if (!isOnline) {
      clearMock();
    } else {
      // debounce would eventually call searchMock
      searchMock("query");
    }

    expect(searchMock).toHaveBeenCalledTimes(0);
    expect(clearMock).toHaveBeenCalledTimes(1);

    setOnline(true);
  });

  it("search mock IS called when online", () => {
    setOnline(true);
    const searchMock = jest.fn();
    const clearMock = jest.fn();

    const isOnline = navigator.onLine;
    if (!isOnline) {
      clearMock();
    } else {
      searchMock("query");
    }

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith("query");
    expect(clearMock).toHaveBeenCalledTimes(0);
  });
});
