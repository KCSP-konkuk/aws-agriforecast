// 작업대 공통 — 지표 색과 표시 형식
import { diffUnit } from '../../lib/series';

// 지표 색: 고른 순서대로 칸을 정하고, 지워도 다른 지표 색은 그대로 (범주 8색, 색약 구분 검증된 순서)
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const colorOf = (slot) => SERIES_COLORS[((slot % 8) + 8) % 8];

// 축 글자 · 격자 · 기준선(지수 100, 대비 0, 추세) · 가장 최근 점 테두리
export const AXIS = { tick: { fontSize: 11, fill: '#64748B' }, grid: '#E0E0E0', base: '#94A3B8', now: '#333333' };

// 산점도 연도 색: 옅은 초록(예전) → 진한 초록(최근)
const YEAR_FROM = [191, 216, 176];
const YEAR_TO = [30, 74, 16];
export function yearColor(year, first, last) {
  const t = last > first ? (year - first) / (last - first) : 1;
  return `rgb(${YEAR_FROM.map((v, i) => Math.round(v + (YEAR_TO[i] - v) * t)).join(',')})`;
}

// Plotly 3D 축 공통 모양
export const sceneAxis = (title, extra = {}) => ({
  title: { text: title, font: { size: 11, color: '#64748B' } },
  gridcolor: '#E0E0E0',
  zerolinecolor: '#94A3B8',
  backgroundcolor: 'rgba(0,0,0,0)',
  tickfont: { size: 10, color: '#64748B' },
  ...extra,
});

// 3D 산점도 계절 색 (범주 색에서)
export const SEASON_COLORS = { 봄: '#1baf7a', 여름: '#e34948', 가을: '#eda100', 겨울: '#2a78d6' };
export const MUTED = '#CBD5E1'; // 조건에 맞지 않는 점·선

// 칸 색 (지형도·시차 상관): 대비·상관처럼 0 이 기준이면 파랑(−)·빨강(+), 값이면 옅은 초록 → 진한 초록
const UP = [217, 83, 79];
const DOWN = [51, 122, 183];
const GREEN_LO = [240, 245, 240];
const GREEN_HI = [44, 94, 26];
export function heatColor(v, { min, max, diverging }) {
  if (v == null || !Number.isFinite(v)) return 'rgba(224,224,224,0.5)';
  if (diverging) {
    const m = Math.max(Math.abs(min), Math.abs(max)) || 1;
    const a = Math.min(Math.abs(v) / m, 1);
    const [r, g, b] = v >= 0 ? UP : DOWN;
    return `rgba(${r},${g},${b},${(0.08 + 0.82 * a).toFixed(3)})`;
  }
  const t = max > min ? Math.min(Math.max((v - min) / (max - min), 0), 1) : 1;
  return `rgb(${GREEN_LO.map((c, i) => Math.round(c + (GREEN_HI[i] - c) * t)).join(',')})`;
}

// 조건 입력값 반올림: 100 이상은 정수, 10 이상은 한 자리, 그 밑은 두 자리
export function nice(v) {
  if (v == null || !Number.isFinite(v)) return null;
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return Number(v.toFixed(digits));
}

// 칸 이름: 일·주 '26.10.04', 순 '26.10 상', 월 '26.10'
export function keyLabel(key, f) {
  const [y, m, d] = key.split('-');
  const yy = y.slice(2);
  if (f === 's') return `${yy}.${Number(m)} ${d === '01' ? '상' : d === '11' ? '중' : '하'}`;
  if (f === 'm') return `${yy}.${Number(m)}`;
  return `${yy}.${m}.${d}`;
}

export const num = (v) =>
  v == null || !Number.isFinite(v) ? '-' : v.toLocaleString('ko-KR', { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 });

// 축 눈금: 만 단위는 '1.2만'
export const tickNum = (v) =>
  Math.abs(v) >= 10000
    ? `${(v / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`
    : v.toLocaleString('ko-KR', { maximumFractionDigits: 1 });

// 부호 붙인 수: +12.3 · −4.1
export const signed = (v, digits = 1) =>
  v == null || !Number.isFinite(v)
    ? '-'
    : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('ko-KR', { maximumFractionDigits: digits })}`;

// 지표 값 한 개를 변환에 맞는 말로: 대비는 부호 + %(기온·강수는 ℃·mm), 지수는 수, 원값은 수 + 단위
export function valueText(line, v) {
  if (v == null || !Number.isFinite(v)) return '-';
  if (line.kind === 'yoy' || line.kind === 'normal') return `${signed(v)}${diffUnit(line.unit) ?? '%'}`;
  if (line.kind === 'index') return num(v);
  return `${num(v)} ${line.unit ?? ''}`.trim();
}

// 조건 한 줄: '양파 반입량 ≤ −15' / '1.5 ≤ 해남 산지 기온'
export function conditionText(line, c) {
  const v = (x) => valueText(line, x);
  if (c.min != null && c.max != null) return `${line.name} ${v(c.min)} ~ ${v(c.max)}`;
  return c.min != null ? `${line.name} ≥ ${v(c.min)}` : `${line.name} ≤ ${v(c.max)}`;
}

const LAG_UNIT = { d: '일', w: '주', s: '순', m: '개월' };
export const lagLabel = (lag, f) => (lag ? `${lag > 0 ? '+' : '−'}${Math.abs(lag)}${LAG_UNIT[f]}` : '없음');

// 주기마다 고를 수 있는 시차 (칸 단위, 설계 4.3: ±90일 · ±9순)
export const LAG_OPTIONS = {
  d: [-90, -60, -30, -21, -14, -7, -3, 0, 3, 7, 14, 21, 30, 60, 90],
  w: [-12, -8, -4, -2, -1, 0, 1, 2, 4, 8, 12],
  s: [-9, -6, -3, -2, -1, 0, 1, 2, 3, 6, 9],
  m: [-6, -3, -2, -1, 0, 1, 2, 3, 6],
};

export const PERIODS = [
  ['1y', '1년'],
  ['3y', '3년'],
  ['5y', '5년'],
  ['all', '전체'],
  ['custom', '직접'],
];

// 기간 문구: '2023.10 ~ 2026.10'
export const spanLabel = (fromKey, toKey) => (fromKey && toKey ? `${fromKey.slice(0, 7).replace('-', '.')} ~ ${toKey.slice(0, 7).replace('-', '.')}` : '');

export const years = (catalogEntry) =>
  catalogEntry?.firstDate ? `${catalogEntry.firstDate.slice(0, 4)}~${(catalogEntry.lastDate ?? '').slice(0, 4)}` : '';
