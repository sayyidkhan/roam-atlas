import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/",
      "node_modules/",
      "playwright-report/",
      "test-results/"
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      ...eslint.configs.recommended.rules,
      // The legacy entry points are migrated incrementally. Unused values are
      // tracked during extraction, then enabled as errors once each boundary
      // is fully TypeScript-owned.
      "no-unused-vars": "off"
    }
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    ...reactHooks.configs.flat["recommended-latest"],
    files: ["src/**/*.tsx"]
  },
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off"
    }
  }
];
