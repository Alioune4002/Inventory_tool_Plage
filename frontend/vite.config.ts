import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.ico",
        "icon.svg",
        "icon_dark.svg",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
        "og-image.png",
      ],
      manifest: {
        name: "StockScan",
        short_name: "StockScan",
        description: "Inventaire multi-services simple et rapide",
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0B1220",
        theme_color: "#0B1220",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages",
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: ({ url, request }) => url.pathname.startsWith("/api/") && request.method === "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "api-get",
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: ({ request }) => ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "assets",
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("react-router")) return "router";
          if (id.includes("react-helmet-async")) return "seo";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@tanstack/react-query")) return "query";
          if (id.includes("@sentry")) return "sentry";
          if (id.includes("html5-qrcode") || id.includes("@zxing")) return "scanner";
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
})
