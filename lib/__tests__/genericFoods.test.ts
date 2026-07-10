/**
 * Tests for lib/genericFoods.ts
 *
 * lib/genericFoods.ts imports from @/src/lib/supabase (Vite-only) and
 * @/db/repos/foods (import.meta.url dependency chain). Both are mocked so
 * the real module never loads those Vite-specific deps under ts-jest.
 */

jest.mock("@/src/lib/supabase", () => ({
  getSupabasePublicClient: jest.fn(),
}));

jest.mock("@/db/repos/foods", () => ({
  upsertMany: jest.fn().mockResolvedValue(undefined),
}));

import { upsertMany } from "@/db/repos/foods";
import { type GenericFoodRow, normalizeGenericRow, search } from "@/lib/genericFoods";
import { getSupabasePublicClient } from "@/src/lib/supabase";

const mockedGetClient = getSupabasePublicClient as jest.MockedFunction<
  typeof getSupabasePublicClient
>;
const mockedUpsertMany = upsertMany as jest.MockedFunction<typeof upsertMany>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const sampleRow: GenericFoodRow = {
  id: "abc-123",
  name: "Pechuga de pollo",
  name_normalized: "pechuga de pollo",
  calories_per_100g: 165,
  protein_per_100g: 31,
  carbs_per_100g: 0,
  fat_per_100g: 3.6,
  category: "carnes",
  data_basis: "crudo",
  source: "bedca",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// ── normalizeGenericRow ───────────────────────────────────────────────────────

describe("normalizeGenericRow()", () => {
  it("maps all fields correctly", () => {
    const result = normalizeGenericRow(sampleRow);

    expect(result.id).toBe("abc-123");
    expect(result.name).toBe("Pechuga de pollo");
    expect(result.caloriesPer100g).toBe(165);
    expect(result.proteinPer100g).toBe(31);
    expect(result.carbsPer100g).toBe(0);
    expect(result.fatPer100g).toBe(3.6);
    expect(result.nameNormalized).toBe("pechuga de pollo");
    expect(result.category).toBe("carnes");
    expect(result.dataBasis).toBe("crudo");
  });

  it("source is always 'generic'", () => {
    const result = normalizeGenericRow(sampleRow);
    expect(result.source).toBe("generic");
  });

  it("brand is null", () => {
    const result = normalizeGenericRow(sampleRow);
    expect(result.brand).toBeNull();
  });

  it("servingSizeG is null", () => {
    const result = normalizeGenericRow(sampleRow);
    expect(result.servingSizeG).toBeNull();
  });

  it("offProductCode is null", () => {
    const result = normalizeGenericRow(sampleRow);
    expect(result.offProductCode).toBeNull();
  });

  it("imageUrl is null", () => {
    const result = normalizeGenericRow(sampleRow);
    expect(result.imageUrl).toBeNull();
  });

  it("preserves null dataBasis", () => {
    const rowNoBasis: GenericFoodRow = { ...sampleRow, data_basis: null };
    const result = normalizeGenericRow(rowNoBasis);
    expect(result.dataBasis).toBeNull();
  });

  it("preserves null category", () => {
    const rowNoCategory: GenericFoodRow = { ...sampleRow, category: null };
    const result = normalizeGenericRow(rowNoCategory);
    expect(result.category).toBeNull();
  });
});

// ── search() ─────────────────────────────────────────────────────────────────

// Build a chainable Supabase query mock.
// The chain settles (resolves) when awaited — both with and without abortSignal.
function makeMockClient(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> & { then?: unknown } = {
    select: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),
    // Make the chain itself thenable so `await query` works without abortSignal.
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Supabase query chain
    then: jest.fn((resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)),
  };
  return { from: jest.fn(() => chain), _chain: chain };
}

describe("search()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUpsertMany.mockResolvedValue([]);
  });

  it("(a) returns normalized results on partial name match", async () => {
    const { from, _chain } = makeMockClient({ data: [sampleRow], error: null });
    mockedGetClient.mockReturnValue({ from } as unknown as ReturnType<
      typeof getSupabasePublicClient
    >);

    const results = await search("pollo");

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("abc-123");
    expect(results[0].source).toBe("generic");
    // ilike should be called with the name_normalized column.
    expect(_chain.ilike).toHaveBeenCalledWith("name_normalized", expect.stringContaining("pollo"));
  });

  it("(b) query is normalized before passing to ilike", async () => {
    const { from, _chain } = makeMockClient({ data: [], error: null });
    mockedGetClient.mockReturnValue({ from } as unknown as ReturnType<
      typeof getSupabasePublicClient
    >);

    // Uppercase with accent — should be normalized to lowercase ascii.
    await search("PECHUGA");

    expect(_chain.ilike).toHaveBeenCalledWith("name_normalized", expect.stringMatching(/pechuga/));
  });

  it("(c) network error causes the function to throw", async () => {
    const errorResult = { data: null, error: { message: "Network error" } };
    const chain: Record<string, jest.Mock> & { then?: unknown } = {
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      abortSignal: jest.fn().mockReturnThis(),
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Supabase query chain
      then: jest.fn((resolve: (v: unknown) => unknown) =>
        Promise.resolve(errorResult).then(resolve)
      ),
    };
    mockedGetClient.mockReturnValue({
      from: jest.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabasePublicClient>);

    await expect(search("pollo")).rejects.toThrow("Network error");
  });

  it("(d) AbortError is propagated as DOMException", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    const chain: Record<string, jest.Mock> & { then?: unknown } = {
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      abortSignal: jest.fn().mockReturnThis(),
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Supabase query chain
      then: jest.fn((_resolve: unknown, reject: (e: unknown) => unknown) =>
        Promise.reject(abortError).catch(reject)
      ),
    };
    mockedGetClient.mockReturnValue({
      from: jest.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabasePublicClient>);

    const controller = new AbortController();
    controller.abort();

    await expect(search("pollo", controller.signal)).rejects.toThrow("Aborted");
  });

  it("upserts results into local cache", async () => {
    const { from } = makeMockClient({ data: [sampleRow], error: null });
    mockedGetClient.mockReturnValue({ from } as unknown as ReturnType<
      typeof getSupabasePublicClient
    >);

    await search("pollo");

    expect(mockedUpsertMany).toHaveBeenCalledTimes(1);
    expect(mockedUpsertMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "abc-123" })])
    );
  });

  it("still returns results when upsertMany fails (non-fatal)", async () => {
    const { from } = makeMockClient({ data: [sampleRow], error: null });
    mockedGetClient.mockReturnValue({ from } as unknown as ReturnType<
      typeof getSupabasePublicClient
    >);
    mockedUpsertMany.mockRejectedValue(new Error("DB write failed"));

    const results = await search("pollo");
    expect(results).toHaveLength(1);
  });

  it("returns empty array for empty query", async () => {
    const { from } = makeMockClient({ data: [], error: null });
    mockedGetClient.mockReturnValue({ from } as unknown as ReturnType<
      typeof getSupabasePublicClient
    >);

    const results = await search("   ");
    expect(results).toHaveLength(0);
    // Should not call Supabase at all for empty query.
    expect(from).not.toHaveBeenCalled();
  });
});
