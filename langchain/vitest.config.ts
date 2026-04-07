/**
 * ══════════════════════════════════════════════════════════════════
 *  Vitest Configuration
 * ══════════════════════════════════════════════════════════════════
 *
 *  Vitest is the modern test runner for TypeScript projects.
 *  It's faster than Jest, has native ESM support, and works
 *  perfectly with the Next.js / LangChain stack.
 *
 *  Run tests:
 *    pnpm test            → run all tests once
 *    pnpm test:watch      → re-run on file change
 *    pnpm test:coverage   → with coverage report
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // ── Environment ─────────────────────────────────────────────
    // "node" for API/lib tests. Use "jsdom" for React component tests.
    environment: "node",

    // ── Global test helpers ──────────────────────────────────────
    // Makes describe/it/expect available without imports in every file
    globals: true,

    // ── Setup file ───────────────────────────────────────────────
    // Runs before every test file — sets env vars, mocks, etc.
    setupFiles: ["./tests/setup.ts"],

    // ── File patterns ────────────────────────────────────────────
    // Vitest picks up files matching these patterns automatically.
    // Evals are excluded — they run via `pnpm eval:tools`, not `pnpm test`
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.spec.ts"],
    exclude: ["tests/evals/**"],

    // ── Coverage ─────────────────────────────────────────────────
    coverage: {
      provider: "v8",          // V8 native coverage (fast, no instrumentation)
      reporter: ["text", "html", "lcov"],
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/**/*.d.ts",
        "lib/**/types.ts",     // skip pure type files
        "node_modules/**",
      ],
      // Fail CI if coverage drops below thresholds
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },

    // ── Timeout ──────────────────────────────────────────────────
    // LangChain calls can be slow — generous timeout for integration tests
    testTimeout: 30_000,
  },

  // ── Path aliases ───────────────────────────────────────────────
  // Mirror Next.js "@/*" alias so imports work identically in tests
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
