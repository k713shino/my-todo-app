/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwind CSSを適用するファイルパスの指定
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // ダークモードをクラスベースで切り替え
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        // 追加のブレークポイント：475px以上でxsクラスを適用
        'xs': '475px',
      },
    },
  },
  plugins: [],
}