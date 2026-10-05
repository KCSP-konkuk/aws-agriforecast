import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { FREQ_LABEL, pearson } from '../../lib/series';
import { AXIS, keyLabel, MUTED, num, tickNum, yearColor } from './format';

const strength = (r) => {
  const a = Math.abs(r);
  return a < 0.2 ? '거의 없어요' : a < 0.4 ? '약해요' : a < 0.7 ? '뚜렷한 편이에요' : '강해요';
};

// 최소제곱 직선 (점이 3개 이상일 때)
function trend(points) {
  const n = points.length;
  if (n < 3) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (!sxx) return null;
  const b = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
  const xs = points.map((p) => p.x);
  const [x1, x2] = [Math.min(...xs), Math.max(...xs)];
  return [
    { x: x1, y: my + b * (x1 - mx) },
    { x: x2, y: my + b * (x2 - mx) },
  ];
}

function ScatterTip({ active, payload, xl, yl, freq }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow px-3 py-2 text-xs">
      <p className="font-semibold text-text-main mb-1">{keyLabel(p.key, freq)}</p>
      <p className="text-text-main">
        가로 · {xl.name} <b>{num(p.x)}</b>
      </p>
      <p className="text-text-main">
        세로 · {yl.name} <b>{num(p.y)}</b>
      </p>
    </div>
  );
}

function AxisSelect({ id, label, value, lines, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-subtext-light">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="max-w-[220px] rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-text-main"
      >
        {lines.map((l, i) => (
          <option key={l.id} value={i}>
            {l.name} · {l.unitLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

// 산점도 — 가로·세로 지표의 같은 칸 값을 점 하나로. 색은 연도(옅을수록 예전), 테두리 점이 가장 최근
export default function ScatterView({ rows, lines, x, y, freq, match, onAxes }) {
  if (lines.length < 2) {
    return <p className="py-16 text-center text-sm text-subtext-light">산점도는 지표가 2개 이상 있어야 그릴 수 있어요.</p>;
  }
  const xl = lines[x] ?? lines[0];
  const yl = lines[y] ?? lines[1];
  const points = rows
    .filter((r) => Number.isFinite(r[xl.id]) && Number.isFinite(r[yl.id]))
    .map((r) => ({ key: r.key, x: r[xl.id], y: r[yl.id], year: Number(r.key.slice(0, 4)) }));
  const { r, n } = pearson(
    points.map((p) => p.x),
    points.map((p) => p.y),
  );
  const years = [...new Set(points.map((p) => p.year))];
  const [y0, y1] = [years[0], years[years.length - 1]];
  const inside = match ? points.filter((p) => match.has(p.key)) : points;
  const outside = match ? points.filter((p) => !match.has(p.key)) : [];
  const byYear = years.map((yr) => ({ yr, data: inside.filter((p) => p.year === yr) })).filter((g) => g.data.length);
  const latest = points[points.length - 1];
  const line = trend(points);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3" data-export="skip">
        <AxisSelect id="scatter-x" label="가로" value={lines.indexOf(xl)} lines={lines} onChange={(v) => onAxes(v, lines.indexOf(yl))} />
        <button
          type="button"
          onClick={() => onAxes(lines.indexOf(yl), lines.indexOf(xl))}
          className="text-subtext-light hover:text-primary"
          aria-label="가로·세로 바꾸기"
          title="가로·세로 바꾸기"
        >
          <span className="material-symbols-outlined text-lg">swap_horiz</span>
        </button>
        <AxisSelect id="scatter-y" label="세로" value={lines.indexOf(yl)} lines={lines} onChange={(v) => onAxes(lines.indexOf(xl), v)} />
      </div>
      {n < 3 ? (
        <p className="py-16 text-center text-sm text-subtext-light">두 지표가 함께 있는 기간이 짧아 점을 찍을 수 없어요.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={AXIS.grid} />
              <XAxis type="number" dataKey="x" tick={AXIS.tick} tickFormatter={tickNum} domain={['auto', 'auto']} name={xl.name} />
              <YAxis type="number" dataKey="y" tick={AXIS.tick} tickFormatter={tickNum} width={56} domain={['auto', 'auto']} name={yl.name} />
              <Tooltip content={<ScatterTip xl={xl} yl={yl} freq={freq} />} />
              {outside.length > 0 && <Scatter data={outside} fill={MUTED} fillOpacity={0.6} isAnimationActive={false} />}
              {byYear.map(({ yr, data }) => (
                <Scatter key={yr} data={data} fill={yearColor(yr, y0, y1)} fillOpacity={0.85} isAnimationActive={false} />
              ))}
              {line && <ReferenceLine segment={line} stroke={AXIS.base} strokeDasharray="5 4" ifOverflow="extendDomain" />}
              <Scatter data={[latest]} fill={yearColor(latest.year, y0, y1)} stroke={AXIS.now} strokeWidth={2} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-subtext-light">
            {y0 < y1 && (
              <span className="flex items-center gap-1.5">
                {y0}
                <span
                  className="inline-block h-2 w-20 rounded"
                  style={{ background: `linear-gradient(to right, ${yearColor(y0, y0, y1)}, ${yearColor(y1, y0, y1)})` }}
                />
                {y1} (옅을수록 예전)
              </span>
            )}
            <span>테두리 점 = 가장 최근 ({keyLabel(latest.key, freq)})</span>
            {match && <span>회색 = 조건 밖 (맞는 점 {inside.length.toLocaleString('ko-KR')}개)</span>}
            <span>점선 = 추세</span>
          </div>
          <p className="mt-3 text-sm text-text-main">
            상관계수 <b>r = {r == null ? '-' : r.toFixed(2)}</b>
            <span className="text-subtext-light">
              {' '}
              · 사례 {n.toLocaleString('ko-KR')}개({FREQ_LABEL[freq]})
            </span>
            {r != null && (
              <>
                {' '}
                — 관계가 {strength(r)}.
                {Math.abs(r) >= 0.2 && (r > 0 ? ' 가로 지표가 높을 때 세로 지표도 높은 편이에요.' : ' 가로 지표가 높을 때 세로 지표는 낮은 편이에요.')}
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-subtext-light">함께 움직였다는 뜻일 뿐, 한쪽이 다른 쪽의 원인이라는 뜻은 아니에요.</p>
        </>
      )}
    </div>
  );
}
