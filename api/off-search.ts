/**
 * Same-origin Open Food Facts search proxy.
 *
 * Owns the CGI-primary + SearchALicious-fallback cascade, server-side
 * User-Agent, retry/backoff on transient upstream errors, response
 * normalization, and structured failure logging — so the browser only ever
 * talks to this same-origin endpoint (spec: Request Contract, Normalized
 * Response Shape, Both-Upstream-Failure Handling, Retry with Backoff,
 * Server-Side User-Agent, Structured Logging on Failures).
 *
 * Runtime: Node.js serverless (NOT Edge) — see design D1. maxDuration is
 * explicitly declared because Vercel Hobby's ambient default is 10s, not
 * 60s; without this the retry/backoff budget (~27s per upstream) gets
 * killed mid-request (tasks: MANDATORY GATE FIX 1.3).
 */
import type { OffProxyProduct, OffProxyResponse, OffProxySource } from "@/lib/offTypes";

export const config = {
  maxDuration: 60,
};

const OFF_CGI_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const OFF_FALLBACK_URL = "https://search.openfoodfacts.org/search";
const OFF_FIELDS =
  "code,product_name,brands,nutriments,serving_quantity,image_front_small_url,image_url,categories_tags";
const OFF_PAGE_SIZE = 20;
const OFF_USER_AGENT = "Vitia/1.0 (+https://vitia.app)";
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_QUERY_LENGTH = 200;
const MAX_RETRIES = 2; // 3 attempts total per upstream
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

interface OffCgiResponse {
  products: OffProxyProduct[];
  count?: number;
}

interface OffFallbackResponse {
  hits: OffProxyProduct[];
  count?: number;
}

interface UpstreamAttemptResult {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

// ── Structured logging ─────────────────────────────────────────────────

function logFailure(context: {
  query: string;
  upstream: string;
  status?: number;
  error?: string;
  attempt: number;
}): void {
  // Structured, single-line JSON so it's grep/query-able in Vercel logs.
  // Never an empty catch — every failure path calls this (spec: Structured
  // Logging on Failures).
  console.error(
    JSON.stringify({
      event: "off_search_upstream_failure",
      query: context.query,
      upstream: context.upstream,
      status: context.status ?? null,
      error: context.error ?? null,
      attempt: context.attempt,
      timestamp: new Date().toISOString(),
    })
  );
}

// ── Backoff ─────────────────────────────────────────────────────────────

function backoffDelayMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  const base = Math.min(1000 * 2 ** attempt, 4000);
  const jitter = Math.random() * 250;
  return base + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Single upstream fetch attempt ──────────────────────────────────────

async function fetchAttempt(
  url: string,
  upstreamName: string,
  query: string,
  attempt: number
): Promise<UpstreamAttemptResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": OFF_USER_AGENT },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!res.ok) {
      logFailure({ query, upstream: upstreamName, status: res.status, attempt });
      return { ok: false, status: res.status };
    }

    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logFailure({ query, upstream: upstreamName, error: message, attempt });
    return { ok: false, error: message };
  }
}

/**
 * Fetch an upstream with retry/backoff (design D3, spec: Retry with
 * Backoff). Retries only on 429/502/503/504 or network/timeout error, up to
 * MAX_RETRIES additional attempts. Non-retryable statuses (e.g. 400, 404)
 * return immediately without retrying.
 */
async function fetchWithRetry(
  url: string,
  upstreamName: string,
  query: string
): Promise<UpstreamAttemptResult> {
  let lastResult: UpstreamAttemptResult = { ok: false, error: "not attempted" };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    lastResult = await fetchAttempt(url, upstreamName, query, attempt);

    if (lastResult.ok) return lastResult;

    // Network/timeout errors (no status) are always retryable.
    const isRetryableStatus =
      lastResult.status === undefined || RETRYABLE_STATUSES.has(lastResult.status);

    if (!isRetryableStatus) {
      // Non-retryable (e.g. 400, 404) — stop immediately, no retry.
      return lastResult;
    }

    if (attempt < MAX_RETRIES) {
      const delay = backoffDelayMs(attempt, null);
      await sleep(delay);
    }
  }

  return lastResult;
}

// ── Upstream calls ─────────────────────────────────────────────────────

async function fetchFromCgi(query: string): Promise<UpstreamAttemptResult> {
  const url = new URL(OFF_CGI_URL);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("cc", "es");
  url.searchParams.set("lc", "es");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(OFF_PAGE_SIZE));
  url.searchParams.set("fields", OFF_FIELDS);

  return fetchWithRetry(url.toString(), "cgi", query);
}

async function fetchFromFallback(query: string): Promise<UpstreamAttemptResult> {
  const url = new URL(OFF_FALLBACK_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("cc", "es");
  url.searchParams.set("lc", "es");
  url.searchParams.set("page_size", String(OFF_PAGE_SIZE));
  url.searchParams.set("fields", OFF_FIELDS);

  return fetchWithRetry(url.toString(), "fallback", query);
}

// ── Normalization (design D4) ──────────────────────────────────────────

function normalizeCgiResponse(data: unknown): OffProxyProduct[] {
  const parsed = data as OffCgiResponse;
  return parsed.products ?? [];
}

function normalizeFallbackResponse(data: unknown): OffProxyProduct[] {
  const parsed = data as OffFallbackResponse;
  return parsed.hits ?? [];
}

function buildSuccessResponse(products: OffProxyProduct[], source: OffProxySource) {
  return {
    products,
    count: products.length,
    source,
  } satisfies OffProxyResponse;
}

// ── Query validation ───────────────────────────────────────────────────

function validateQuery(rawQuery: string | string[] | undefined): string | null {
  if (typeof rawQuery !== "string") return null;
  const trimmed = rawQuery.trim();
  if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) return null;
  return trimmed;
}

// ── Handler ─────────────────────────────────────────────────────────────

interface VercelRequestLike {
  query: Record<string, string | string[] | undefined>;
}

interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  json(body: unknown): void;
}

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike
): Promise<void> {
  const query = validateQuery(req.query.q);

  if (query === null) {
    res.status(400).json({ error: "Missing or invalid 'q' query parameter" });
    return;
  }

  // 1. CGI primary — more precise relevance.
  const cgiResult = await fetchFromCgi(query);
  if (cgiResult.ok) {
    const products = normalizeCgiResponse(cgiResult.data);
    res.status(200).json(buildSuccessResponse(products, "cgi"));
    return;
  }

  // 2. Fallback — SearchALicious (broader results), only after CGI
  //    exhausts its retries (spec: Fallback succeeds after CGI failure).
  const fallbackResult = await fetchFromFallback(query);
  if (fallbackResult.ok) {
    const products = normalizeFallbackResponse(fallbackResult.data);
    res.status(200).json(buildSuccessResponse(products, "fallback"));
    return;
  }

  // 3. Both upstreams failed — structured 502, never throw unhandled or
  //    return HTML/empty body (spec: Both-Upstream-Failure Handling).
  logFailure({
    query,
    upstream: "both",
    error: `cgi: ${cgiResult.error ?? cgiResult.status}; fallback: ${fallbackResult.error ?? fallbackResult.status}`,
    attempt: -1,
  });
  res.status(502).json({
    error: "Both upstream Open Food Facts endpoints failed",
    source: "none",
  } satisfies OffProxyResponse);
}
