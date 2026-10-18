const mockEnqueue = jest.fn();
jest.mock("@/db/client", () => ({
  db: {},
  dexieAdapter: { syncQueue: { enqueue: (...a: unknown[]) => mockEnqueue(...a) } },
}));
jest.mock("@/db/schema", () => ({ syncQueue: {} }));

type Mod = typeof import("@/src/services/syncQueue");

function load(): Mod {
  let mod!: Mod;
  jest.isolateModules(() => {
    mod = require("@/src/services/syncQueue");
  });
  return mod;
}

const base = { table: "meal_entries", op: "upsert", row: "{}", userId: "u" } as const;
const stamps = () => mockEnqueue.mock.calls.map((c) => c[0].updatedAt as string);

beforeEach(() => {
  mockEnqueue.mockReset();
  mockEnqueue.mockResolvedValue(undefined);
});

describe("enqueue updatedAt", () => {
  it("issues strictly increasing timestamps for same-millisecond enqueues", async () => {
    const q = load();
    const t = "2026-01-01T00:00:00.000Z";

    await Promise.all([
      q.enqueue({ ...base, updatedAt: t }),
      q.enqueue({ ...base, updatedAt: t }),
      q.enqueue({ ...base, updatedAt: t }),
    ]);

    expect(stamps()).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.001Z",
      "2026-01-01T00:00:00.002Z",
    ]);
  });

  it("never goes backwards when the caller provides an older timestamp", async () => {
    const q = load();

    await q.enqueue({ ...base, updatedAt: "2026-06-01T00:00:00.000Z" });
    await q.enqueue({ ...base, updatedAt: "2000-01-01T00:00:00.000Z" });

    expect(stamps()).toEqual(["2026-06-01T00:00:00.000Z", "2026-06-01T00:00:00.001Z"]);
  });

  it("accepts 'YYYY-MM-DD HH:MM:SS' as UTC and stores ISO", async () => {
    const q = load();

    await q.enqueue({ ...base, updatedAt: "2026-03-04 05:06:07" });

    expect(stamps()).toEqual(["2026-03-04T05:06:07.000Z"]);
  });

  it("falls back to now for an unparseable value", async () => {
    const q = load();
    const before = Date.now();

    await q.enqueue({ ...base, updatedAt: "garbage" });

    const ms = Date.parse(stamps()[0]);
    expect(ms).toBeGreaterThanOrEqual(before);
  });

  it("invokes the onEnqueue listener after a successful enqueue only", async () => {
    const q = load();
    const cb = jest.fn();
    q.setOnEnqueue(cb);

    await q.enqueue({ ...base, updatedAt: "2026-01-01T00:00:00.000Z" });
    expect(cb).toHaveBeenCalledTimes(1);

    const err = jest.spyOn(console, "error").mockImplementation(() => {});
    mockEnqueue.mockRejectedValueOnce(new Error("boom"));
    await q.enqueue({ ...base, updatedAt: "2026-01-01T00:00:00.000Z" });
    err.mockRestore();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
