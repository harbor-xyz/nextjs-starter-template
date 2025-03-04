/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["dotenv/config"],
    include: ["**/*.test.{ts,tsx}"],
    testTimeout: 100000, // Added timeout setting

    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
