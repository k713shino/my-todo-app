import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 新規コード用: 重要度に応じたレベル設定
      "@typescript-eslint/no-explicit-any": "warn", // フェーズ2で大量修正後にerrorへ
      "@typescript-eslint/no-unused-vars": ["warn", { // 既存コード多数のため一旦warn
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "react-hooks/exhaustive-deps": "warn", // 慎重に確認が必要なため警告のまま
      "@next/next/no-img-element": "error", // すでに修正完了

      // フェーズ2: 安全性ルールを段階的に有効化
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",

      // 型推論・型安全性（推奨ルール）
      "@typescript-eslint/prefer-as-const": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
      "@typescript-eslint/no-require-imports": "warn",

      // React関連
      "react/no-unescaped-entities": "off",

      // Next.js関連
      "@next/next/no-html-link-for-pages": "off",

      // その他のルール
      "prefer-const": "error",
      "no-unused-vars": "off" // TypeScript版を使用
    }
  }
];

export default eslintConfig;