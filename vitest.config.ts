import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Los tests de integración comparten una sola "empresa de prueba" en
    // Postgres (ver tests/fixtures.ts) — correrlos en paralelo pisaría
    // el estado del uno al otro.
    fileParallelism: false,
  },
});
