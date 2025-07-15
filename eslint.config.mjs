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
      // TypeScript関連のルールを緩和（ビルドエラー対応）
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      
      // Function型の使用を許可（必要な場合のみ）
      "@typescript-eslint/ban-types": [
        "error",
        {
          "types": {
            "Function": false, // Function型の使用を許可
            "{}": false,
            "Object": false
          },
          "extendDefaults": true
        }
      ],
      
      // Redis関連でunknown型を使う場合を許可
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off", 
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      
      // 本番ビルドでの警告を緩和
      "@typescript-eslint/prefer-as-const": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      
      // React関連の警告を緩和
      "react-hooks/exhaustive-deps": "warn",
      "react/no-unescaped-entities": "off",
      
      // Next.js関連
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "off"
    }
  }
];

export default eslintConfig;