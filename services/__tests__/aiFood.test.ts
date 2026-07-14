/** @jest-environment jsdom */
// Tests for services/aiFood.ts.
// fetch is mocked globally; navigator.onLine is controlled per-test.
// lib/env is mocked so ts-jest never parses import.meta.env.

jest.mock("@/lib/env", () => ({ VITIA_AI_URL: "https://ai.example.com" }));

import { analyzePhoto, parseText } from "@/services/aiFood";
import { AiServiceError, ConfigurationError, OfflineError } from "@/types/aiFood";

const BASE_URL = "https://ai.example.com";

const RAW_FOOD = {
  foodId: "food-abc-123",
  name: "Manzana",
  kcal: "80",
  protein: "0.4",
  carbs: "21",
  fat: "0.2",
  quantity: "150",
  unit: "g",
  confidence: "high",
};

const NORMALIZED = {
  foodId: "food-abc-123",
  name: "Manzana",
  kcal: 80,
  protein: 0.4,
  carbs: 21,
  fat: 0.2,
  quantity: 150,
  unit: "g",
  confidence: "high",
};

function mockFetchOk(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(status = 500) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: "Server error" }),
  });
}

function mockFetchReject(err: Error) {
  global.fetch = jest.fn().mockRejectedValue(err);
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

beforeEach(() => {
  setOnline(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("aiFood service — normalize", () => {
  it("coerces string numbers to numbers and returns correct AIFoodItem shape", async () => {
    mockFetchOk({ foods: [RAW_FOOD] });
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const results = await analyzePhoto(file);
    expect(results[0]).toEqual(NORMALIZED);
  });

  it("defaults unit to 'g' when unit is missing", async () => {
    const rawNoUnit = { ...RAW_FOOD, unit: undefined };
    mockFetchOk({ foods: [rawNoUnit] });
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const [result] = await analyzePhoto(file);
    expect(result.unit).toBe("g");
  });

  it("clamps unknown confidence to 'low'", async () => {
    const rawBadConf = { ...RAW_FOOD, confidence: "very_high" };
    mockFetchOk({ foods: [rawBadConf] });
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const [result] = await analyzePhoto(file);
    expect(result.confidence).toBe("low");
  });
});

describe("aiFood service — ConfigurationError", () => {
  it("throws ConfigurationError when VITIA_AI_URL is not set", async () => {
    jest.resetModules();
    jest.doMock("@/lib/env", () => ({ VITIA_AI_URL: undefined }));
    const { analyzePhoto: analyze } = await import("@/services/aiFood");
    const { ConfigurationError: CE } = await import("@/types/aiFood");
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await expect(analyze(file)).rejects.toThrow(CE);
    jest.resetModules();
  });
});

describe("aiFood service — OfflineError", () => {
  it("throws OfflineError when navigator.onLine is false", async () => {
    setOnline(false);
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await expect(analyzePhoto(file)).rejects.toThrow(OfflineError);
  });
});

describe("aiFood service — AiServiceError", () => {
  it("throws AiServiceError on non-2xx response", async () => {
    mockFetchError(500);
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await expect(analyzePhoto(file)).rejects.toThrow(AiServiceError);
  });

  it("throws AiServiceError on fetch network rejection", async () => {
    mockFetchReject(new TypeError("Failed to fetch"));
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await expect(analyzePhoto(file)).rejects.toThrow(AiServiceError);
  });
});

describe("aiFood service — parseText", () => {
  it("sends JSON body with text field", async () => {
    mockFetchOk({ foods: [RAW_FOOD] });
    await parseText("100g de arroz");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/parse");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ text: "100g de arroz" });
  });
});

describe("aiFood service — analyzePhoto", () => {
  it("sends FormData with image field", async () => {
    mockFetchOk({ foods: [RAW_FOOD] });
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await analyzePhoto(file);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/analyze");
    expect(init.body).toBeInstanceOf(FormData);
  });
});
