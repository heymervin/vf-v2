import { defineConfig } from "vitest/config";
import * as path from "node:path";

// Unit-test runner for pure server-side logic (GHL client, crypto, webhooks).
// DB-backed and UI flows are covered by Playwright e2e, not here.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // e2e/ is Playwright's; never let vitest pick those up.
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
