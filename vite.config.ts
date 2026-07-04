import path from "node:path";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

const OFF_CGI_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const OFF_FALLBACK_URL = "https://search.openfoodfacts.org/search";
const OFF_USER_AGENT = "Vitia/1.0 (+https://vitia.app)";

/**
 * Dev-only stand-in for api/off-search.ts. Vite's config loader doesn't
 * resolve the "@" tsconfig alias the real handler imports, so this mirrors
 * just the normalization contract (products/count/source) instead of
 * importing it — retry/backoff/logging only need to exist server-side in
 * prod. Without this, `vite`-only dev search throws on every query because
 * the old proxy forwarded the raw `{hits}` shape the client no longer reads.
 */
function offSearchDevMiddleware(): Plugin {
  return {
    name: "off-search-dev-middleware",
    configureServer(server) {
      server.middlewares.use("/api/off-search", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const query = url.searchParams.get("q")?.trim();

        if (!query) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing or invalid 'q' query parameter" }));
          return;
        }

        try {
          const cgiUrl = new URL(OFF_CGI_URL);
          cgiUrl.searchParams.set("search_terms", query);
          cgiUrl.searchParams.set("json", "1");
          const cgiRes = await fetch(cgiUrl, { headers: { "User-Agent": OFF_USER_AGENT } });
          if (cgiRes.ok) {
            const data = (await cgiRes.json()) as { products?: unknown[] };
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                products: data.products ?? [],
                count: (data.products ?? []).length,
                source: "cgi",
              })
            );
            return;
          }

          const fallbackUrl = new URL(OFF_FALLBACK_URL);
          fallbackUrl.searchParams.set("q", query);
          const fallbackRes = await fetch(fallbackUrl, {
            headers: { "User-Agent": OFF_USER_AGENT },
          });
          if (fallbackRes.ok) {
            const data = (await fallbackRes.json()) as { hits?: unknown[] };
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                products: data.hits ?? [],
                count: (data.hits ?? []).length,
                source: "fallback",
              })
            );
            return;
          }

          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Both upstream Open Food Facts endpoints failed",
              source: "none",
            })
          );
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error:
                err instanceof Error
                  ? err.message
                  : "Both upstream Open Food Facts endpoints failed",
              source: "none",
            })
          );
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  plugins: [
    react(),
    tsconfigPaths(),
    offSearchDevMiddleware(),
    VitePWA({
      registerType: "prompt",
      // Inject the SW registration script into index.html
      injectRegister: "auto",
      manifest: {
        name: "Vitia",
        short_name: "Vitia",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#F5A623",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        // Precache all static assets produced by Vite (app shell)
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm,webmanifest}"],
        runtimeCaching: [
          {
            // Same-origin OFF search proxy — network-first, fall back to
            // cache for offline. Only cache 200s (not opaque/error
            // responses) since it's our own endpoint (design D5).
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/off-search"),
            handler: "NetworkFirst",
            options: {
              cacheName: "off-proxy-cache",
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 6, // 6 hours
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
        ],
      },
    }),
  ],
  // Dev server headers for COOP/COEP — required for crossOriginIsolated (OPFS).
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      "/api/off": {
        target: "https://world.openfoodfacts.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/off/, ""),
      },
    },
  },
});
