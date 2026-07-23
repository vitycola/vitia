/** @jest-environment jsdom */
/**
 * Tests for stores/useAiAddFlowStore.ts.
 * services/aiFood is mocked so store lifecycle logic is isolated.
 */

jest.mock("@/services/aiFood", () => ({
  analyzePhoto: jest.fn(),
  parseText: jest.fn(),
}));

import * as aiService from "@/services/aiFood";
import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { AiServiceError } from "@/types/aiFood";
import type { AIFoodItem } from "@/types/aiFood";

const mockAnalyzePhoto = aiService.analyzePhoto as jest.MockedFunction<
  typeof aiService.analyzePhoto
>;
const mockParseText = aiService.parseText as jest.MockedFunction<typeof aiService.parseText>;

const HIGH_ITEM: AIFoodItem = {
  name: "Manzana",
  kcal: 80,
  protein: 0.4,
  carbs: 21,
  fat: 0.2,
  quantity: 150,
  unit: "g",
  confidence: "high",
};

const MEDIUM_ITEM: AIFoodItem = {
  name: "Arroz",
  kcal: 200,
  protein: 4,
  carbs: 44,
  fat: 0.4,
  quantity: 100,
  unit: "g",
  confidence: "medium",
};

const LOW_ITEM: AIFoodItem = {
  name: "Desconocido",
  kcal: 100,
  protein: 1,
  carbs: 10,
  fat: 1,
  quantity: 50,
  unit: "g",
  confidence: "low",
};

function getStore() {
  return useAiAddFlowStore.getState();
}

beforeEach(() => {
  useAiAddFlowStore.getState().reset();
  mockAnalyzePhoto.mockReset();
  mockParseText.mockReset();
});

describe("step transitions", () => {
  it("starts at selection step", () => {
    expect(getStore().step).toBe("selection");
  });

  it("chooseMode sets inputMode and moves to input step", () => {
    getStore().chooseMode("photo");
    expect(getStore().step).toBe("input");
    expect(getStore().inputMode).toBe("photo");
  });

  it("chooseMode text sets text mode", () => {
    getStore().chooseMode("text");
    expect(getStore().inputMode).toBe("text");
  });

  it("back from input returns to selection", () => {
    getStore().chooseMode("photo");
    getStore().back();
    expect(getStore().step).toBe("selection");
  });

  it("back from results returns to input", () => {
    getStore().chooseMode("photo");
    mockAnalyzePhoto.mockResolvedValueOnce([HIGH_ITEM]);
    // Manually set step to results for regression test
    useAiAddFlowStore.setState({ step: "results", results: [HIGH_ITEM] });
    getStore().back();
    expect(getStore().step).toBe("input");
  });

  it("back from confirmation returns to results", () => {
    useAiAddFlowStore.setState({ step: "confirmation" });
    getStore().back();
    expect(getStore().step).toBe("results");
  });

  it("goToConfirmation moves to confirmation step", () => {
    useAiAddFlowStore.setState({ step: "results", results: [HIGH_ITEM] });
    getStore().goToConfirmation();
    expect(getStore().step).toBe("confirmation");
  });
});

describe("defaultChecked by confidence", () => {
  it("high confidence → checked by default", () => {
    getStore().setResults([HIGH_ITEM]);
    expect(getStore().selections[0]).toBe(true);
  });

  it("medium confidence → checked by default", () => {
    getStore().setResults([MEDIUM_ITEM]);
    expect(getStore().selections[0]).toBe(true);
  });

  it("low confidence → unchecked by default", () => {
    getStore().setResults([LOW_ITEM]);
    expect(getStore().selections[0]).toBe(false);
  });

  it("quantities initialized from item.quantity", () => {
    getStore().setResults([HIGH_ITEM, MEDIUM_ITEM]);
    expect(getStore().quantities[0]).toBe(150);
    expect(getStore().quantities[1]).toBe(100);
  });
});

describe("toggleItem / setQuantity", () => {
  beforeEach(() => {
    getStore().setResults([HIGH_ITEM, LOW_ITEM]);
  });

  it("toggleItem flips selection", () => {
    expect(getStore().selections[0]).toBe(true);
    getStore().toggleItem(0);
    expect(getStore().selections[0]).toBe(false);
  });

  it("setQuantity updates the quantity for the given index", () => {
    getStore().setQuantity(0, 200);
    expect(getStore().quantities[0]).toBe(200);
  });
});

describe("setMeal", () => {
  it("updates selectedMeal", () => {
    getStore().setMeal("lunch");
    expect(getStore().selectedMeal).toBe("lunch");
  });
});

describe("checkedMacroTotals", () => {
  it("sums macros for checked items only", () => {
    getStore().setResults([HIGH_ITEM, LOW_ITEM]);
    // HIGH_ITEM checked (high), LOW_ITEM unchecked (low)
    const totals = getStore().checkedMacroTotals();
    expect(totals.kcal).toBeCloseTo(80);
    expect(totals.protein).toBeCloseTo(0.4);
  });

  it("respects quantity edits when computing totals", () => {
    getStore().setResults([HIGH_ITEM]);
    // Double the quantity → double the macros
    getStore().setQuantity(0, 300);
    const totals = getStore().checkedMacroTotals();
    expect(totals.kcal).toBeCloseTo(160);
  });

  it("excludes unchecked items from totals", () => {
    getStore().setResults([HIGH_ITEM]);
    getStore().toggleItem(0); // uncheck
    const totals = getStore().checkedMacroTotals();
    expect(totals.kcal).toBe(0);
  });
});

describe("reset", () => {
  it("returns to INITIAL_STATE", () => {
    getStore().chooseMode("text");
    getStore().setResults([HIGH_ITEM]);
    getStore().setMeal("dinner");
    getStore().reset();
    const s = getStore();
    expect(s.step).toBe("selection");
    expect(s.inputMode).toBeNull();
    expect(s.results).toEqual([]);
    expect(s.selections).toEqual({});
    expect(s.quantities).toEqual({});
    expect(s.selectedMeal).toBeNull();
    expect(s.status).toBe("idle");
    expect(s.error).toBeNull();
  });
});

describe("submitPhoto", () => {
  it("on success: step=results, results populated", async () => {
    mockAnalyzePhoto.mockResolvedValueOnce([HIGH_ITEM]);
    getStore().chooseMode("photo");
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await getStore().submitPhoto(file);
    expect(getStore().step).toBe("results");
    expect(getStore().results).toEqual([HIGH_ITEM]);
    expect(getStore().status).toBe("idle");
  });

  it("on AiServiceError: status=error with Spanish message, stays on input", async () => {
    mockAnalyzePhoto.mockRejectedValueOnce(new AiServiceError("fail"));
    getStore().chooseMode("photo");
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await getStore().submitPhoto(file);
    expect(getStore().step).toBe("input");
    expect(getStore().status).toBe("error");
    expect(getStore().error).toBeTruthy();
  });
});

describe("submitText", () => {
  it("on success: step=results, results populated", async () => {
    mockParseText.mockResolvedValueOnce([MEDIUM_ITEM]);
    getStore().chooseMode("text");
    await getStore().submitText("100g de arroz");
    expect(getStore().step).toBe("results");
    expect(getStore().results).toEqual([MEDIUM_ITEM]);
  });

  it("on AiServiceError: status=error, stays on input", async () => {
    mockParseText.mockRejectedValueOnce(new AiServiceError("fail"));
    getStore().chooseMode("text");
    await getStore().submitText("texto");
    expect(getStore().step).toBe("input");
    expect(getStore().status).toBe("error");
  });
});
