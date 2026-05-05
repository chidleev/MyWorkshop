import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import vuePlugin from "eslint-plugin-vue";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vuePlugin.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
  prettierConfig,
];
