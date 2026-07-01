import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    // `npm run worker:dev` (wrangler dev, port 8787) を別途起動して
    // /api/* をそちらに転送する(フロントはViteのHMRを保ったまま)
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "ライフログ",
        short_name: "ライフログ",
        description: "体重・食事を記録して10月末の目標体重を目指すライフログアプリ",
        start_url: "/",
        display: "standalone",
        background_color: "#FFF8F0",
        theme_color: "#FF6B4A",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
});
