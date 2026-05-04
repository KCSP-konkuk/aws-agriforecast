// 공통 Tailwind CSS 설정
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#2C5E1A",
        "primary-light": "#F0F5F0",
        "accent": "#FFC700",
        "text-main": "#333333",
        "price-up": "#D9534F",
        "price-down": "#337AB7",
        "background-light": "#f7f8f6",
        "background-dark": "#182111",
        "green-brand": {
          DEFAULT: "#1A535C",
          light: "#2E7C88",
        },
        "off-white": "#F7F9F9",
        "charcoal-gray": "#2B2B2B",
        "muted-blue": "#4E8098",
        "surface-light": "#FFFFFF",
        "surface-dark": "#2a2a2a",
        "text-light": "#333333",
        "text-dark": "#e0e0e0",
        "text-secondary-light": "#666666",
        "text-secondary-dark": "#b0b0b0",
        "border-light": "#e0e0e0",
        "border-dark": "#444444",
        "subtext-light": "#64748B",
        "subtext-dark": "#94A3B8",
        "accent-past": "#4A90E2",
        "accent-forecast": "#E87B3E",
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
};

