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
        // 정석 제품 화면(토스증권 · 네이버 증권 수준). 초록은 주요 동작 · 선택 · 강조에만. 회색은 초록 쪽으로 아주 살짝 기운다
        // 글자 대비(흰 바탕): 본문 16.8 · 보조 6.0 · 오름 5.2 · 내림 5.2 — 작은 글자도 4.5 이상
        "primary": {
          DEFAULT: "#2C5E1A",
          hover: "#234B15",
          light: "#EEF4EA",
        },
        "accent": "#FFC700",
        "text-main": "#191F1C",
        "subtext-light": "#5D6560",
        "border-light": "#E3E7E3",
        "line": "#EDF0ED",
        "surface-light": "#FFFFFF",
        "background-light": "#F4F6F4",
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
