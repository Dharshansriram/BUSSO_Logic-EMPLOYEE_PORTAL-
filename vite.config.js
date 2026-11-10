import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// This config was trimmed down from the original Manus template.
// The original also loaded `@builder.io/vite-plugin-jsx-loc` and
// `vite-plugin-manus-runtime`, plus a custom "debug collector" plugin
// that wrote browser console/network logs to disk. Those packages are
// internal to the Manus hosting platform and are not published to the
// public npm registry, so `pnpm install` / `pnpm dev` / `pnpm build`
// would fail outside of Manus. None of them are required to run the
// app, so they've been removed to make this an install-and-run project
// anywhere Node.js is available.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5174, // Manager Portal uses 5173
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: {
      // Express (npm run dev:api) or FastAPI (npm run dev:backend) on port 8000
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
