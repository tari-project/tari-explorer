import { defineConfig } from "eslint/config";
import eslintPluginRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.commonjs,
      },
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off", // allow any types
      "prefer-const": "warn",
      "no-constant-binary-expression": "error",
      "no-undef": "error",
    },
    ignores: ["build", "**/*.js"],
  },
  // eslintPluginRecommended,
]);
