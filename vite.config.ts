import { defineConfig } from "vite";
// allow reading process.env in this config without requiring @types/node
declare const process: any;
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["images/favicon.ico"],
      manifest: {
        name: "SG HIRING",
        short_name: "SG HIRING",
        description: "SG HIRING – Saber Group's recruitment and hiring platform",
        theme_color: "#E3302C",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "ar",
        icons: [
          { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa/maskable-icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/pwa/maskable-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
    // include visualizer only when ANALYZE=1 to avoid generating on every build
    ...(process.env.ANALYZE ? [visualizer({ filename: 'dist/stats.html', title: 'Bundle Visualizer', gzipSize: true })] : []),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id) return;
          if (id.includes('node_modules')) {
            const parts = id.toString().split('node_modules/')[1].split('/');
            // Handle scoped packages
            const pkg = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
            return `vendor.${pkg.replace('@', '').replace('/', '.')}`;
          }
        },
      },
    },
  },
});
