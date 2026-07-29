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
    files: [
      "apps/**/*.ts",
      "apps/**/*.tsx",
      "libs/**/*.ts",
      "libs/**/*.tsx",
      "test/**/*.ts",
      "test/**/*.tsx"
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    ...reactHooks.configs.flat["recommended-latest"],
    files: ["apps/web/src/**/*.tsx"]
  },
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off"
    }
  },
  {
    files: ["apps/web/src/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:*",
                "@roamatlas/api",
                "@roamatlas/api/*",
                "**/apps/api/**"
              ],
              message: "The web app may use shared libraries or HTTP clients, never API internals or Node built-ins."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["apps/api/src/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/*",
                "react-dom",
                "react-dom/*",
                "@roamatlas/web",
                "@roamatlas/web/*",
                "**/apps/web/**"
              ],
              message: "The API must remain independent of React and the web deployment."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["libs/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:*",
                "@roamatlas/api",
                "@roamatlas/api/*",
                "@roamatlas/web",
                "@roamatlas/web/*",
                "**/apps/api/**",
                "**/apps/web/**"
              ],
              message: "Shared libraries must stay independent of deployable applications and runtime infrastructure."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["libs/contracts/**/*.{js,ts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@roamatlas/data",
                "@roamatlas/data/*",
                "@roamatlas/domain",
                "@roamatlas/domain/*",
                "@roamatlas/prompts",
                "@roamatlas/prompts/*"
              ],
              message: "Contracts are the lowest shared layer and cannot depend on other RoamAtlas libraries."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["libs/data/**/*.{js,ts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@roamatlas/contracts",
                "@roamatlas/contracts/*",
                "@roamatlas/domain",
                "@roamatlas/domain/*",
                "@roamatlas/prompts",
                "@roamatlas/prompts/*"
              ],
              message: "Shared data must remain dependency-free product input."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["libs/prompts/**/*.{js,ts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@roamatlas/contracts",
                "@roamatlas/contracts/*",
                "@roamatlas/data",
                "@roamatlas/data/*",
                "@roamatlas/domain",
                "@roamatlas/domain/*"
              ],
              message: "Prompt builders cannot depend on contracts, catalog data, or domain orchestration."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["libs/domain/**/*.{js,ts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@roamatlas/contracts",
                "@roamatlas/contracts/*",
                "@roamatlas/data",
                "@roamatlas/data/*"
              ],
              message: "Domain policy may depend on prompt construction, but not transport contracts or catalog configuration."
            }
          ]
        }
      ]
    }
  }
];
