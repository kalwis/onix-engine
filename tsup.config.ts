import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/xml.ts", "src/validation.ts", "src/builders.ts", "src/schema.ts"],
  clean: true,
  dts: true,
  format: ["esm", "cjs"],
  sourcemap: true,
  target: "node22",
});
