import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // These rules are intentionally scoped to existing legacy code paths.
  // They will be revisited when the affected components are refactored.
  {
    files: ["app/api/webhooks/instagram/route.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "app/dashboard/insights/InsightsDashboard.tsx",
      "components/dashboard/AutomationForm.tsx",
      "components/dashboard/AutomationManager.tsx",
      "components/dashboard/IceBreakerManager.tsx",
      "components/dashboard/InstagramInsights.tsx",
      "components/dashboard/PersistentMenuManager.tsx",
      "components/dashboard/publishing/PublishingDashboard.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["types/index.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
]);

export default eslintConfig;
