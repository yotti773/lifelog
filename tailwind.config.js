/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#FFF8F0", // アイボリーホワイト
        primary: "#FF6B4A", // コーラルオレンジ
        secondary: "#2EC4B6", // フレッシュミントティール
        accent: "#FFC145", // サニーイエロー
        ink: "#2B2B2B", // テキスト(主) チャコール
        muted: "#8C8C8C", // テキスト(補助) ウォームグレー
      },
      fontFamily: {
        rounded: ['"M PLUS Rounded 1c"', "sans-serif"],
        body: ['"Noto Sans JP"', "sans-serif"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        soft: "0 4px 16px rgba(43, 43, 43, 0.08)",
      },
    },
  },
  plugins: [],
};
