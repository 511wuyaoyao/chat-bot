/**
 * Debug React 前端的 Vite 构建配置。
 */

import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: path.resolve(__dirname, "src/frontend/react"),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "dist/debug/frontend/assets"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/frontend/react/main.tsx"),
      output: {
        entryFileNames: "client.js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((name) => name.endsWith(".css"))) return "styles.css";
          return "assets/[name][extname]";
        },
      },
    },
  },
});
