/**
 * Unit tests for api/off-search.ts — the same-origin OFF search proxy.
 *
 * Spec: Request Contract, Normalized Response Shape, Both-Upstream-Failure
 * Handling, Retry with Backoff on Transient Errors, Server-Side User-Agent,
 * Structured Logging on Failures.
 *
 * fetch and setTimeout/Math.random are mocked so retry/backoff runs
 * instantly and deterministically in the test suite.
 */
import handler from "@/api/off-search";

interface MockResponse {
  status(code: number): MockResponse;
  json(body: unknown): void;
  _statusCode?: number;
  _body?: unknown;
}

function makeMockResponse(): MockResponse {
  const res: MockResponse = {
    status(code: number) {
      res._statusCode = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
    },
  };
  return res;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("api/off-search handler", () => {
  const originalFetch = global.fetch;
  const originalSetTimeout = global.setTimeout;
  const originalRandom = Math.random;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Make backoff sleeps resolve instantly so retry tests run fast.
    global.setTimeout = ((fn: () => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;
    Math.random = () => 0;
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
    Math.random = originalRandom;
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  // ── Request Contract ────────────────────────────────────────────────

  it("returns 400 when q is missing", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const req = { query: {} };
    const res = makeMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns 400 when q is empty after trim", async () => {
    const req = { query: { q: "   " } };
    const res = makeMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(400);
  });

  it("returns 400 when q exceeds the max length", async () => {
    const req = { query: { q: "a".repeat(201) } };
    const res = makeMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(400);
  });

  // ── Normalized Response Shape ────────────────────────────────────────

  it("returns { products, source: 'cgi' } when CGI succeeds", async () => {
    const products = [{ code: "123", product_name: "Banana" }];
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { products, count: 1 }));

    const req = { query: { q: "banana" } };
    const res = makeMockResponse();
    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(res._body).toEqual({ products, count: 1, source: "cgi" });
    // Server UA attached on the outbound call (spec: Server-Side User-Agent)
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers["User-Agent"]).toBe("Vitia/1.0 (+https://vitia.app)");
  });

  it("returns { products, source: 'fallback' } when CGI fails and fallback succeeds", async () => {
    const hits = [{ code: "456", product_name: "Apple" }];
    global.fetch = jest
      .fn()
      // CGI: non-retryable 404 — no retry, straight to fallback
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(200, { hits, count: 1 }));

    const req = { query: { q: "apple" } };
    const res = makeMockResponse();
    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(res._body).toEqual({ products: hits, count: 1, source: "fallback" });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ── Both-Upstream-Failure Handling ───────────────────────────────────

  it("returns 502 with { error, source: 'none' } when both upstreams fail", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, {}));

    const req = { query: { q: "nomatch" } };
    const res = makeMockResponse();
    await handler(req, res);

    expect(res._statusCode).toBe(502);
    expect(res._body).toMatchObject({ source: "none" });
    expect((res._body as { error: string }).error).toEqual(expect.any(String));
  });

  it("logs a structured entry (no empty catch) on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, {}));

    const req = { query: { q: "logtest" } };
    const res = makeMockResponse();
    await handler(req, res);

    expect(consoleErrorSpy).toHaveBeenCalled();
    const firstLog = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(firstLog.event).toBe("off_search_upstream_failure");
    expect(firstLog.query).toBe("logtest");
  });

  // ── Retry with Backoff ────────────────────────────────────────────────

  it("retries a 503 and recovers without invoking fallback", async () => {
    const products = [{ code: "789", product_name: "Recovered" }];
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { products, count: 1 }));

    const req = { query: { q: "retry" } };
    const res = makeMockResponse();
    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(res._body).toEqual({ products, count: 1, source: "cgi" });
    // Only CGI was called (2 attempts), fallback never invoked.
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries on repeated 503s then falls back", async () => {
    const hits = [{ code: "999", product_name: "Fallback Item" }];
    global.fetch = jest
      .fn()
      // CGI: 3 attempts total (MAX_RETRIES=2), all 503
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(503, {}))
      // Fallback succeeds on first attempt
      .mockResolvedValueOnce(jsonResponse(200, { hits, count: 1 }));

    const req = { query: { q: "exhaust" } };
    const res = makeMockResponse();
    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(res._body).toEqual({ products: hits, count: 1, source: "fallback" });
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it("does not retry a non-retryable 400 and proceeds directly to fallback", async () => {
    const hits: unknown[] = [];
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(400, {}))
      .mockResolvedValueOnce(jsonResponse(200, { hits, count: 0 }));

    const req = { query: { q: "badrequest" } };
    const res = makeMockResponse();
    await handler(req, res);

    // Exactly 2 calls total: 1 CGI attempt (no retry) + 1 fallback attempt.
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(res._statusCode).toBe(200);
  });

  it("treats network/timeout errors as retryable", async () => {
    const products = [{ code: "abc", product_name: "Network Recovered" }];
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce(jsonResponse(200, { products, count: 1 }));

    const req = { query: { q: "networkerr" } };
    const res = makeMockResponse();
    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(res._body).toEqual({ products, count: 1, source: "cgi" });
  });
});
