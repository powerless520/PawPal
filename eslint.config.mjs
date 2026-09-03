// ESLint v9 flat config. Intentionally minimal — the project has
// accumulated 130+ commits without any lint enforcement and we
// don't want a one-time sweep of "fix everything" to drown the
// real signal. Rules are strict enough to catch genuine bugs but
// forgiving on style (Prettier handles that).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/renderer/**/*.{ts,tsx}", "src/shared/**/*.ts", "tests/**/*.ts", "electron.vite.config.ts", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        // Browser + Electron renderer
        window: "readonly",
        document: "readonly",
        console: "readonly",
        // Test runner sets these up
        describe: "readonly",
        it: "readonly",
        before: "readonly",
        after: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly"
      }
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin
    },
    settings: { react: { version: "detect" } },
    rules: {
      // React
      "react/jsx-uses-react": "off", // we don't import React explicitly
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // TypeScript — recommended set is on, override the noisy ones
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "off", // Electron + IPC types lean on any
      "@typescript-eslint/no-empty-function": "off",
      // General
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["src/main/**/*.ts"],
    languageOptions: {
      globals: {
        // Electron main process globals
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly"
      }
    }
  },
  {
    ignores: [
      "node_modules/**",
      "out/**",
      "dist/**",
      ".pnpm-store/**",
      "scripts/mp4-to-pawpal-gif.sh",
      "scripts/test.mjs",
      "docs/**",
      "pet_assets/**"
    ]
  }
);