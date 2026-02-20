import { defineConfig } from "vite";
// allow reading process.env in this config without requiring @types/node
declare const process: any;
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { visualizer } from "rollup-plugin-visualizer";

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
