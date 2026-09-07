import ts from "typescript-eslint";
export default ts.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**"] },
  ...ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
