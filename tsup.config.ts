import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/xml.ts",
    "src/validation.ts",
    "src/builders.ts",
    "src/codelists.ts",
    "src/thema.ts",
  ],
  clean: true,
  dts: true,
  format: ["esm", "cjs"],
  sourcemap: false,
  target: "node22",
});
