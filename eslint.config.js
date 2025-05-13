import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintPluginRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default defineConfig([
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.commonjs,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    rules: {
      "prefer-const": "warn",
      "no-constant-binary-expression": "error",
      "no-undef": "error",
    },
  },
  eslintPluginRecommended,
]);
