/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 색은 여기 정의한 토큰만 쓴다. 페이지에 hex 를 직접 적지 말 것
      colors: {
        "primary": {
          DEFAULT: "#2C5E1A",
          hover: "#234B15",
          light: "#F0F5F0",
        },
        "accent": "#FFC700",
        "text-main": "#333333",
        "subtext-light": "#64748B",
        "border-light": "#E0E0E0",
        "surface-light": "#FFFFFF",
        "background-light": "#F7F8F6",
        // 한국 시세 표기 관례: 상승 빨강, 하락 파랑
        "price-up": "#D9534F",
        "price-down": "#337AB7",
      },
      fontFamily: {
        "display": ["Work Sans", "Noto Sans KR", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px",
      },
    },
  },
  plugins: [],
}
