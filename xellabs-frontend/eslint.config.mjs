import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const nextConfigs = compat.extends("next/core-web-vitals", "next/typescript");
for (const cfg of nextConfigs) {
  if (cfg.plugins && cfg.plugins["react-hooks"]) {
    cfg.plugins["react-hooks"].rules = {
      ...cfg.plugins["react-hooks"].rules,
      "set-state-in-effect": { create: () => ({}) },
      "refs": { create: () => ({}) },
    };
  }
}

const eslintConfig = [
  ...nextConfigs,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;


