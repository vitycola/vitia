import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
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
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm}"],
        runtimeCaching: [
          {
            // Open Food Facts API — network-first, fall back to cache for offline
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "off-api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
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
  },
});
