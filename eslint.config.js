import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "src/generated",
      "data/generated",
      "examples/codelist-browser/dist/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  {
    files: ["examples/codelist-browser/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  prettier,
);
