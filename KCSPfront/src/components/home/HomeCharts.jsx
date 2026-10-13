import { colorOf, heatColor } from '../workbench/format';
import { quantile } from '../../lib/series';

// 홈 질문 패널의 작은 차트들 — 배치(home_highlights)가 계산해 둔 값을 SVG 로 그대로 그린다.
// 홈 첫 로드를 가볍게 두려고 작업대의 차트 라이브러리를 쓰지 않는다. 모든 차트는 600×300 좌표계

const W = 600;
const H = 300;
const UP = '#CC2F2F';
const DOWN = '#2E6BC6';
const GRID = '#EAF0EB';
const BASE = '#C9CFCA';
const MUTED = '#A9B0AB';
const PRIMARY = '#174F3C';
const TEXT = '#182D26';

const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
const pathOf = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 보기 좋은 눈금 (1 · 2 · 2.5 · 5 단위). 첫 눈금 ≤ lo, 마지막 눈금 ≥ hi 라 값이 틀 밖으로 나가지 않는다
function ticks(lo, hi, count = 4) {
  const step0 = (hi - lo) / count || 1;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const out = [];
  let v = Math.floor(lo / step + 1e-9) * step;
  do {
    out.push(Number(v.toFixed(6)));
    v += step;
  } while (out[out.length - 1] < hi - step * 1e-6);
  return out;
}

const won = (v) => (Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(v % 10000 ? 1 : 0)}만` : v.toLocaleString('ko-KR'));
const pct = (v) => `${v > 0 ? '+' : ''}${v}%`;

function Frame({ label, children }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

function YGrid({ values, y, x0 = 52, x1 = W - 16, format = String, base }) {
  return values.map((v) => (
    <g key={v}>
      <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke={v === base ? BASE : GRID} strokeDasharray={v === base ? '4 4' : undefined} />
      <text x={x0 - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#60736A">
        {format(v)}
      </text>
    </g>
  ));
}

function Legend({ items, note }) {
  let x = 60;
  return (
    <g fontSize="12">
      {items.map(({ name, color, dashed }) => {
        const at = x;
        x += 26 + name.length * 12;
        return (
          <g key={name}>
            <line x1={at} x2={at + 16} y1={15} y2={15} stroke={color} strokeWidth="3" strokeDasharray={dashed ? '5 3' : undefined} />
            <text x={at + 21} y={19} fill={TEXT}>
              {name}
            </text>
          </g>
        );
      })}
      {note && (
        <text x={W - 16} y={19} textAnchor="end" fontSize="12" fill="#60736A">
          {note}
        </text>
      )}
    </g>
  );
}

// 분기 첫 달(1 · 4 · 7 · 10월)이 처음 나오는 칸에 '26.4' 처럼
function MonthLabels({ dates, x, y = H - 8 }) {
  const seen = new Set();
  return dates.map((d, i) => {
    const [yy, mm] = [d.slice(2, 4), Number(d.slice(5, 7))];
    if (![1, 4, 7, 10].includes(mm) || seen.has(`${yy}${mm}`)) return null;
    seen.add(`${yy}${mm}`);
    return (
      <text key={d} x={x(i)} y={y} textAnchor="middle" fontSize="12" fill="#60736A">
        {`${yy}.${mm}`}
      </text>
    );
  });
}

function Overlay({ chart }) {
  const pts = chart.points;
  const vals = pts.flatMap((p) => [p[1], p[2]]);
  const t = ticks(Math.min(...vals), Math.max(...vals));
  const x = scale(0, pts.length - 1, 52, W - 16);
  const y = scale(t[0], t[t.length - 1], H - 34, 32);
  return (
    <Frame label={`${chart.names.join(', ')} 최근 1년 주별 지수`}>
      <YGrid values={t} y={y} base={100} />
      <MonthLabels dates={pts.map((p) => p[0])} x={x} />
      <path d={pathOf(pts.map((p, i) => [x(i), y(p[2])]))} fill="none" stroke={colorOf(1)} strokeWidth="2" />
      <path d={pathOf(pts.map((p, i) => [x(i), y(p[1])]))} fill="none" stroke={colorOf(0)} strokeWidth="2.4" />
      <Legend items={[{ name: chart.names[0], color: colorOf(0) }, { name: chart.names[1], color: colorOf(1) }]} note="첫 주 = 100" />
    </Frame>
  );
}

function Lag({ chart }) {
  const bars = chart.bars.filter(([, r]) => r != null);
  const t = ticks(Math.min(0, ...bars.map(([, r]) => r)), Math.max(0.6, ...bars.map(([, r]) => r)));
  const y = scale(t[0], t[t.length - 1], H - 40, 34);
  const x = scale(0, chart.bars.length - 1, 96, W - 56);
  return (
    <Frame label="시차별 상관">
      <YGrid values={t} y={y} base={0} format={(v) => v.toFixed(1)} />
      {bars.map(([k, r]) => {
        const hot = k === chart.best;
        const [top, bottom] = r >= 0 ? [y(r), y(0)] : [y(0), y(r)];
        return (
          <g key={k}>
            <rect x={x(k) - 24} y={top} width="48" height={Math.max(bottom - top, 1)} rx="3" fill={hot ? PRIMARY : '#CBD5C4'} />
            <text x={x(k)} y={r >= 0 ? top - 6 : bottom + 14} textAnchor="middle" fontSize="12" fontWeight="600" fill={hot ? PRIMARY : TEXT}>
              {r.toFixed(2)}
            </text>
            <text x={x(k)} y={H - 18} textAnchor="middle" fontSize="12" fill="#60736A">
              {k === 0 ? '같은 순' : `${k}순 뒤`}
            </text>
          </g>
        );
      })}
      <text x={W - 16} y={19} textAnchor="end" fontSize="12" fill="#60736A">
        도매 쪽 변화 → 소매 변화 상관 (전년 대비)
      </text>
    </Frame>
  );
}

function Scatter({ chart }) {
  const xs = chart.points.map((p) => p[0]);
  const ys = chart.points.map((p) => p[1]);
  const [x0, x1] = [Math.min(quantile(xs, 0.02), -chart.cut * 2), Math.max(quantile(xs, 0.98), chart.cut * 2)];
  const [y0, y1] = [quantile(ys, 0.02), quantile(ys, 0.98)];
  const tx = ticks(x0, x1);
  const ty = ticks(y0, y1);
  const x = scale(tx[0], tx[tx.length - 1], 60, W - 16);
  const y = scale(ty[0], ty[ty.length - 1], H - 36, 30);
  const [left, right] = [x(-chart.cut), x(chart.cut)];
  const median = (g, color, xFrom, xTo, dy) =>
    g?.median != null && (
      <g>
        <line x1={xFrom} x2={xTo} y1={y(clamp(g.median, ty[0], ty[ty.length - 1]))} y2={y(clamp(g.median, ty[0], ty[ty.length - 1]))} stroke={color} strokeWidth="2.2" />
        <text x={(xFrom + xTo) / 2} y={y(clamp(g.median, ty[0], ty[ty.length - 1])) + dy} textAnchor="middle" fontSize="12" fontWeight="600" fill={color}>
          중앙 {pct(Math.round(g.median))}
        </text>
      </g>
    );
  return (
    <Frame label={`${chart.names.join(', ')} 전년 대비 산점도`}>
      <rect x={60} y={30} width={left - 60} height={H - 66} fill={UP} opacity="0.06" />
      <rect x={right} y={30} width={W - 16 - right} height={H - 66} fill={DOWN} opacity="0.06" />
      <YGrid values={ty} y={y} x0={60} base={0} format={(v) => pct(v)} />
      {tx.map((v) => (
        <text key={v} x={x(v)} y={H - 16} textAnchor="middle" fontSize="12" fill="#60736A">
          {pct(v)}
        </text>
      ))}
      {chart.points.map(([px, py], i) => {
        const color = px < -chart.cut ? UP : px > chart.cut ? DOWN : MUTED;
        return <circle key={i} cx={x(clamp(px, tx[0], tx[tx.length - 1]))} cy={y(clamp(py, ty[0], ty[ty.length - 1]))} r="2.4" fill={color} opacity={color === MUTED ? 0.45 : 0.7} />;
      })}
      {median(chart.low, UP, 60, left, -8)}
      {median(chart.high, DOWN, right, W - 16, 18)}
      <text x={W - 16} y={19} textAnchor="end" fontSize="12" fill="#60736A">
        가로 {chart.names[0]} · 세로 {chart.names[1]} (전년 대비)
      </text>
    </Frame>
  );
}

function Heat({ chart }) {
  const n = chart.years.length;
  const x0 = 64;
  const cw = (W - x0 - 12) / 36;
  const ch = Math.min(20, (H - 70) / n);
  const top = 34;
  return (
    <Frame label="해마다 순별 가격을 그해 평균과 견준 지형도">
      {chart.rows.map((row, i) =>
        row.map((v, p) => (
          <rect key={`${i}-${p}`} x={x0 + p * cw} y={top + i * ch} width={cw - 1} height={ch - 1} fill={v == null ? '#F1F3EF' : heatColor(v - 1, { min: -0.6, max: 0.6, diverging: true })} />
        )),
      )}
      {chart.years.map((yv, i) =>
        i === 0 || i === n - 1 || yv % 5 === 0 ? (
          <text key={yv} x={x0 - 8} y={top + i * ch + ch / 2 + 4} textAnchor="end" fontSize="12" fill="#60736A">
            {yv}
          </text>
        ) : null,
      )}
      {[1, 3, 5, 7, 9, 11].map((m) => (
        <text key={m} x={x0 + (m - 1) * 3 * cw + cw * 1.5} y={top + n * ch + 16} textAnchor="middle" fontSize="12" fill="#60736A">
          {m}월
        </text>
      ))}
      <rect x={x0 + chart.peak * cw - 1} y={top - 3} width={cw + 1} height={n * ch + 4} fill="none" stroke={TEXT} strokeWidth="1.5" />
      <g fontSize="12" fill="#60736A">
        <text x={W - 140} y={19} textAnchor="end">
          그해 평균보다
        </text>
        <rect x={W - 132} y={10} width="12" height="12" fill={DOWN} />
        <text x={W - 116} y={20}>
          쌈
        </text>
        <rect x={W - 92} y={10} width="12" height="12" fill={UP} />
        <text x={W - 76} y={20}>
          비쌈
        </text>
      </g>
    </Frame>
  );
}

function Parallel({ chart }) {
  const all = chart.lines.flat();
  const t = ticks(quantile(all, 0.02), quantile(all, 0.98));
  const [lo, hi] = [t[0], t[t.length - 1]];
  const y = scale(lo, hi, H - 44, 46);
  const axes = [90, 300, 510];
  const line = (l) => pathOf(l.map((v, i) => [axes[i], y(clamp(v, lo, hi))]));
  const hit = (l) => l[0] < chart.cut;
  return (
    <Frame label={`${chart.names.join(', ')} 평행 좌표`}>
      {axes.map((ax) => (
        <line key={ax} x1={ax} x2={ax} y1={y(hi)} y2={y(lo)} stroke={BASE} />
      ))}
      {t.map((v) => (
        <text key={v} x={axes[0] - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#60736A">
          {pct(v)}
        </text>
      ))}
      {chart.lines.filter((l) => !hit(l)).map((l, i) => (
        <path key={`m${i}`} d={line(l)} fill="none" stroke={MUTED} strokeOpacity="0.13" />
      ))}
      {chart.lines.filter(hit).map((l, i) => (
        <path key={`h${i}`} d={line(l)} fill="none" stroke={UP} strokeOpacity="0.35" strokeWidth="1.2" />
      ))}
      <rect x={axes[0] - 7} y={y(clamp(chart.cut, lo, hi))} width="14" height={y(lo) - y(clamp(chart.cut, lo, hi))} fill="#FFC700" opacity="0.55" />
      {chart.names.map((name, i) => (
        <text key={name} x={axes[i]} y={34} textAnchor="middle" fontSize="13" fontWeight="700" fill={TEXT}>
          {name}
        </text>
      ))}
      <text x={W / 2} y={H - 14} textAnchor="middle" fontSize="12" fill="#60736A">
        세 축 모두 전년 같은 순 대비 · 진한 선 = 반입량 {chart.cut}% 아래
      </text>
    </Frame>
  );
}

function Forecast({ chart }) {
  const pts = chart.points;
  const vals = pts.flatMap((p) => [p[1], p[2]]).filter((v) => v != null);
  const t = ticks(Math.min(...vals) * 0.95, Math.max(...vals) * 1.03);
  const x = scale(0, pts.length - 1, 64, W - 16);
  const y = scale(t[0], t[t.length - 1], H - 34, 32);
  const actual = pts.map((p, i) => [i, p[2]]).filter(([, v]) => v != null);
  return (
    <Frame label={`${chart.names.join(', ')} 순별`}>
      <YGrid values={t} y={y} x0={64} format={won} />
      <MonthLabels dates={pts.map((p) => p[0])} x={x} />
      <path d={pathOf(actual.map(([i, v]) => [x(i), y(v)]))} fill="none" stroke={colorOf(0)} strokeWidth="2.2" />
      <path d={pathOf(pts.map((p, i) => [x(i), y(p[1])]))} fill="none" stroke={colorOf(1)} strokeWidth="2" strokeDasharray="5 4" />
      {pts.map((p, i) => (
        <circle key={p[0]} cx={x(i)} cy={y(p[1])} r="2.6" fill={colorOf(1)} />
      ))}
      <Legend items={[{ name: '실제', color: colorOf(0) }, { name: 'AI 예측', color: colorOf(1), dashed: true }]} note={chart.unit} />
    </Frame>
  );
}

const CHARTS = { overlay: Overlay, lag: Lag, scatter: Scatter, heat: Heat, parallel: Parallel, forecast: Forecast };

export default function HomeChart({ chart }) {
  const Chart = CHARTS[chart?.type];
  return Chart ? <Chart chart={chart} /> : null;
}

// 오늘의 시장 칸의 작은 추이선
export function Sparkline({ values, direction }) {
  if (!values?.length) return <div className="h-9" />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.12 || 1;
  const x = scale(0, values.length - 1, 3, 117);
  const y = scale(lo - pad, hi + pad, 34, 4);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const color = direction === 'up' ? UP : direction === 'down' ? DOWN : MUTED;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 120 38" className="block h-9 w-full" aria-hidden="true">
      <path d={`${pathOf(pts)}L${last[0].toFixed(1)},36L${pts[0][0].toFixed(1)},36Z`} fill={color} opacity="0.1" />
      <path d={pathOf(pts)} fill="none" stroke={color} strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}
