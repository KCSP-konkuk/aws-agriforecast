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
        // 밝은 농식품 테크: forest · mint · warm white. 등락 색은 브랜드 색과 구분한다
        "primary": {
          DEFAULT: "#174F3C",
          hover: "#103C2D",
          light: "#E4F3EB",
        },
        "accent": "#D9A441",
        "mint": "#D6EDE1",
        "forest": "#103C2D",
        "text-main": "#182D26",
        "subtext-light": "#60736A",
        "border-light": "#DCE6DF",
        "line": "#EAF0EB",
        "surface-light": "#FFFFFF",
        "background-light": "#F3F6F2",
        // 한국 시세 표기 관례: 상승 빨강, 하락 파랑
        "price-up": "#CC2F2F",
        "price-down": "#2E6BC6",
      },
      fontFamily: {
        // 한 가족으로 제목 · 본문 · 숫자까지 (Pretendard, 레포에 묶어 배포)
        "sans": ['"Pretendard Variable"', "Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", '"Apple SD Gothic Neo"', '"Malgun Gothic"', "sans-serif"],
        "display": ['"Pretendard Variable"', "Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", '"Apple SD Gothic Neo"', '"Malgun Gothic"', "sans-serif"],
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
