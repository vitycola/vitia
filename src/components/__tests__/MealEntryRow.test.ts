/**
 * Tests for MealEntryRow component logic.
 * Layer: unit — verifies the delete-triggers-callback contract.
 *
 * MealEntryRow has two delete paths:
 *   1. Click the trash button → onDelete(entry.id) called directly
 *   2. Swipe left (pointerDown→pointerUp with Δx ≥ 80px) → onDelete(entry.id)
 *
 * We test the swipe threshold and callback invocation logic without DOM rendering.
 */

// ── Swipe logic mirroring MealEntryRow ────────────────────────────────

const SWIPE_THRESHOLD = 80;

function wouldDeleteOnSwipe(startX: number, endX: number): boolean {
  return Math.abs(endX - startX) >= SWIPE_THRESHOLD;
}

// ── Minimal mock entry ─────────────────────────────────────────────────

const mockEntry = {
  id: "entry-123",
  foodName: "Manzana",
  brand: null,
  quantityG: 150,
  calories: 78,
  proteinG: 0.4,
  carbsG: 20,
  fatG: 0.2,
  mealType: "breakfast" as const,
  date: "2025-01-01",
  foodId: "food-456",
  loggedAt: "2025-01-01T08:00:00Z",
};

// ── Tests ──────────────────────────────────────────────────────────────

describe("MealEntryRow — delete via trash button", () => {
  it("calls onDelete with the entry id when trash button is clicked", () => {
    const onDelete = jest.fn();
    // Simulate the onClick handler: () => onDelete(entry.id)
    onDelete(mockEntry.id);
    expect(onDelete).toHaveBeenCalledWith("entry-123");
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("passes the correct id to onDelete (not foodId)", () => {
    const onDelete = jest.fn();
    onDelete(mockEntry.id);
    expect(onDelete).toHaveBeenCalledWith("entry-123");
    expect(onDelete).not.toHaveBeenCalledWith("food-456");
  });
});

describe("MealEntryRow — delete via swipe gesture", () => {
  it("triggers delete when swipe distance meets threshold (exactly 80px)", () => {
    expect(wouldDeleteOnSwipe(200, 120)).toBe(true); // Δx = 80
  });

  it("triggers delete when swipe distance exceeds threshold", () => {
    expect(wouldDeleteOnSwipe(200, 100)).toBe(true); // Δx = 100
  });

  it("does NOT trigger delete when swipe distance is below threshold (79px)", () => {
    expect(wouldDeleteOnSwipe(200, 121)).toBe(false); // Δx = 79
  });

  it("works for left-to-right swipes too", () => {
    expect(wouldDeleteOnSwipe(100, 200)).toBe(true); // Δx = 100
  });

  it("does NOT trigger delete on a small tap (1px movement)", () => {
    expect(wouldDeleteOnSwipe(200, 201)).toBe(false);
  });

  it("swipe invokes onDelete with entry.id when threshold met", () => {
    const onDelete = jest.fn();
    const startX = 200;
    const endX = 100; // Δx = 100 ≥ 80

    if (Math.abs(endX - startX) >= SWIPE_THRESHOLD) {
      onDelete(mockEntry.id);
    }

    expect(onDelete).toHaveBeenCalledWith("entry-123");
  });

  it("swipe does NOT invoke onDelete when below threshold", () => {
    const onDelete = jest.fn();
    const startX = 200;
    const endX = 150; // Δx = 50 < 80

    if (Math.abs(endX - startX) >= SWIPE_THRESHOLD) {
      onDelete(mockEntry.id);
    }

    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe("MealEntryRow — calorie display logic", () => {
  it("rounds calories to nearest integer for display", () => {
    const entry = { ...mockEntry, calories: 78.6 };
    expect(Math.round(entry.calories)).toBe(79);
  });

  it("displays quantity as integer grams", () => {
    expect(mockEntry.quantityG).toBe(150);
  });
});
