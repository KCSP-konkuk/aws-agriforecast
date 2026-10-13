// 대시보드 공통 도우미.
// 차트 라이브러리는 클래스가 아니라 색 값을 받아서, tailwind.config.js 토큰과 같은 값을 여기 한 곳에만 둔다
export const COLOR = {
  up: '#CC2F2F', // price-up (상승 빨강)
  down: '#2E6BC6', // price-down (하락 파랑)
  primary: '#174F3C',
  accent: '#FFC700',
  main: '#182D26', // text-main
  sub: '#60736A', // subtext-light
  grid: '#EAF0EB', // line
};

// 토큰 색에 투명도만 입힌다 (1년 달력 칸)
export const tint = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const won = (v) => (v == null ? '-' : `${Math.round(v).toLocaleString()}원`);

// 0.123 → "+12%". 반올림해 0 이면 부호 없이 "0%"
export const signedPct = (v, digits = 0) => {
  if (v == null) return '-';
  const n = (Math.abs(v) * 100).toFixed(digits);
  if (Number(n) === 0) return '0%';
  return `${v > 0 ? '+' : '−'}${n}%`;
};

export const DIRECTION = {
  up: { text: 'text-price-up' },
  down: { text: 'text-price-down' },
  flat: { text: 'text-text-main' },
};

// "2026-10-03T12:41+09:00" → "10월 3일 12:41"
export const updatedLabel = (iso) => {
  if (!iso) return '';
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${Number(m[1])}월 ${Number(m[2])}일 ${m[3]}:${m[4]}` : '';
};

// "201407상순" → "2014년 7월"
export const sinceLabel = (code) => (code ? `${code.slice(0, 4)}년 ${Number(code.slice(4, 6))}월` : '');
