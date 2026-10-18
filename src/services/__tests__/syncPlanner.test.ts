import type { SyncQueueRow } from "@/db/schema";
import { planFlush } from "@/src/services/syncPlanner";

const U = "user-1";
let seq = 0;

function shuffle<T>(items: T[]): T[] {
  // Deterministic reorder (reverse + rotate) so tests do not rely on randomness
  const out = [...items].reverse();
  out.push(out.shift() as T);
  return out;
}

function upsert(
  id: string,
  rowId: string,
  t: number,
  extra: Record<string, unknown> = {},
  table: SyncQueueRow["table"] = "meal_entries"
): SyncQueueRow {
  seq++;
  return {
    id,
    table,
    op: "upsert",
    row: JSON.stringify({ id: rowId, date: "2026-01-01", meal_type: "lunch", ...extra }),
    userId: U,
    updatedAt: new Date(t).toISOString(),
  };
}

function del(id: string, rowId: string, t: number): SyncQueueRow {
  return {
    id,
    table: "meal_entries",
    op: "delete",
    row: JSON.stringify({ id: rowId }),
    userId: U,
    updatedAt: new Date(t).toISOString(),
  };
}

function bulkDel(id: string, date: string, mealType: string, t: number): SyncQueueRow {
  return {
    id,
    table: "meal_entries",
    op: "delete",
    row: JSON.stringify({ date, meal_type: mealType, bulk: true }),
    userId: U,
    updatedAt: new Date(t).toISOString(),
  };
}

const ids = (ops: SyncQueueRow[]) => ops.map((o) => o.id);

describe("planFlush", () => {
  it("orders ops chronologically regardless of input order", () => {
    const ops = [
      upsert("a", "A", 1),
      upsert("b", "B", 2),
      upsert("c", "C", 3),
      upsert("d", "D", 4),
    ];

    const { ordered, superseded } = planFlush(shuffle(ops));

    expect(ids(ordered)).toEqual(["a", "b", "c", "d"]);
    expect(superseded).toEqual([]);
  });

  it("supersedes an earlier upsert when the same row is deleted later", () => {
    const ops = [upsert("up", "X", 1), del("del", "X", 2)];

    const { ordered, superseded } = planFlush(shuffle(ops));

    expect(superseded).toEqual(["up"]);
    expect(ids(ordered)).toEqual(["del"]);
  });

  it("never plans an upsert of X after a delete of X when the upsert is older", () => {
    const ops = [upsert("up1", "X", 1), upsert("up2", "X", 2), del("del", "X", 3)];

    const { ordered } = planFlush(shuffle(ops));
    const delIdx = ordered.findIndex((o) => o.op === "delete");
    const upsertAfter = ordered.slice(delIdx + 1).filter((o) => o.op === "upsert");

    expect(upsertAfter).toEqual([]);
  });

  it("keeps only the latest of several upserts for the same row", () => {
    const ops = [upsert("e1", "X", 1), upsert("e2", "X", 2), upsert("e3", "X", 3)];

    const { ordered, superseded } = planFlush(shuffle(ops));

    expect(ids(ordered)).toEqual(["e3"]);
    expect(superseded.sort()).toEqual(["e1", "e2"]);
  });

  it("handles edit followed by delete", () => {
    const ops = [upsert("create", "X", 1), upsert("edit", "X", 2), del("del", "X", 3)];

    const { ordered, superseded } = planFlush(shuffle(ops));

    expect(ids(ordered)).toEqual(["del"]);
    expect(superseded.sort()).toEqual(["create", "edit"]);
  });

  it("keeps an upsert that comes after the delete", () => {
    const ops = [upsert("old", "X", 1), del("del", "X", 2), upsert("again", "X", 3)];

    const { ordered, superseded } = planFlush(shuffle(ops));

    expect(ids(ordered)).toEqual(["del", "again"]);
    expect(superseded).toEqual(["old"]);
  });

  it("bulk delete supersedes matching earlier upserts only", () => {
    const ops = [
      upsert("hit", "A", 1, { date: "2026-01-01", meal_type: "lunch" }),
      upsert("otherMeal", "B", 2, { date: "2026-01-01", meal_type: "dinner" }),
      upsert("otherDate", "C", 3, { date: "2026-01-02", meal_type: "lunch" }),
      bulkDel("bulk", "2026-01-01", "lunch", 4),
      upsert("later", "D", 5, { date: "2026-01-01", meal_type: "lunch" }),
    ];

    const { ordered, superseded } = planFlush(shuffle(ops));

    expect(superseded).toEqual(["hit"]);
    expect(ids(ordered)).toEqual(["otherMeal", "otherDate", "bulk", "later"]);
  });

  it("breaks timestamp ties with upsert before delete, then by id", () => {
    const ops = [del("d1", "Y", 5), upsert("u2", "B", 5), upsert("u1", "A", 5)];

    const { ordered } = planFlush(shuffle(ops));

    expect(ids(ordered)).toEqual(["u1", "u2", "d1"]);
  });

  it("supersedes a same-timestamp upsert by its delete (copy then delete)", () => {
    const { ordered, superseded } = planFlush([del("d", "X", 5), upsert("u", "X", 5)]);

    expect(superseded).toEqual(["u"]);
    expect(ids(ordered)).toEqual(["d"]);
  });

  it("understands legacy camelCase payloads", () => {
    const legacy: SyncQueueRow = {
      id: "legacy",
      table: "meal_entries",
      op: "upsert",
      row: JSON.stringify({ id: "X", date: "2026-01-01", mealType: "lunch" }),
      userId: U,
      updatedAt: new Date(1).toISOString(),
    };
    const bulkCamel: SyncQueueRow = {
      id: "bulk",
      table: "meal_entries",
      op: "delete",
      row: JSON.stringify({ date: "2026-01-01", mealType: "lunch", bulk: true }),
      userId: U,
      updatedAt: new Date(2).toISOString(),
    };

    const { ordered, superseded } = planFlush([bulkCamel, legacy]);

    expect(superseded).toEqual(["legacy"]);
    expect(ids(ordered)).toEqual(["bulk"]);
  });

  it("sorts progress_entries without compacting them", () => {
    const ops = [
      upsert("p2", "P", 2, {}, "progress_entries"),
      upsert("p1", "P", 1, {}, "progress_entries"),
    ];

    const { ordered, superseded } = planFlush(ops);

    expect(superseded).toEqual([]);
    expect(ids(ordered)).toEqual(["p1", "p2"]);
  });

  it("keeps only the latest users_profile upsert per user", () => {
    const other = { ...upsert("o", "me", 2, {}, "users_profile"), userId: "user-2" };
    const ops = [
      upsert("u3", "me", 3, {}, "users_profile"),
      upsert("u1", "me", 1, {}, "users_profile"),
      other,
      upsert("u2", "me", 2, {}, "users_profile"),
    ];

    const { ordered, superseded } = planFlush(shuffle(ops));

    expect(superseded.sort()).toEqual(["u1", "u2"]);
    expect(ids(ordered)).toEqual(["o", "u3"]);
  });

  it("a bulk-superseded upsert still supersedes earlier upserts of the same id", () => {
    const ops = [
      upsert("t1", "X", 1, { meal_type: "dinner" }),
      upsert("t2", "X", 2, { meal_type: "lunch" }),
      bulkDel("t3", "2026-01-01", "lunch", 3),
    ];

    const { ordered, superseded } = planFlush(shuffle(ops));

    expect(superseded.sort()).toEqual(["t1", "t2"]);
    expect(ids(ordered)).toEqual(["t3"]);
  });

  it("sorts ops with an unparseable timestamp last", () => {
    const bad = { ...upsert("bad", "B", 1), updatedAt: "x" };
    const ops = [bad, upsert("good2", "C", 2), upsert("good1", "A", 1)];

    const { ordered } = planFlush(shuffle(ops));

    expect(ids(ordered)).toEqual(["good1", "good2", "bad"]);
  });

  it("keeps the id-greater upsert when two upserts of a row share a timestamp", () => {
    const { ordered, superseded } = planFlush([upsert("b", "X", 5), upsert("a", "X", 5)]);

    expect(superseded).toEqual(["a"]);
    expect(ids(ordered)).toEqual(["b"]);
  });

  it("does not compact across users", () => {
    const other = { ...del("del", "X", 2), userId: "user-2" };

    const { superseded } = planFlush([upsert("up", "X", 1), other]);

    expect(superseded).toEqual([]);
  });

  it("keeps ops whose payload cannot be parsed", () => {
    const broken: SyncQueueRow = { ...upsert("bad", "X", 1), row: "{not json" };

    const { ordered, superseded } = planFlush([broken, del("del", "X", 2)]);

    expect(superseded).toEqual([]);
    expect(ids(ordered)).toEqual(["bad", "del"]);
  });
});
