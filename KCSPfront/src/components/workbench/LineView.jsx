import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, colorOf, keyLabel, lagLabel, num, tickNum } from './format';

// 지수는 100, 전년·평년 대비는 0 에 기준선
const BASELINE = { index: 100, yoy: 0, normal: 0 };

function LineTip({ active, payload, lines, freq }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow px-3 py-2 text-xs">
      <p className="font-semibold text-text-main mb-1">{keyLabel(row.key, freq)}</p>
      {lines.map(
        (l) =>
          row[l.id] != null && (
            <p key={l.id} className="text-text-main">
              <span style={{ color: colorOf(l.color) }}>●</span> {l.name}
              {l.lag ? <span className="text-subtext-light"> ({lagLabel(l.lag, freq)})</span> : null} <b>{num(row[l.id])}</b>
            </p>
          ),
      )}
    </div>
  );
}

// 시계열 겹쳐 보기 — 같은 단위끼리 한 판. 단위가 다르면 판을 나눈다(두 축 차트는 만들지 않는다)
// 조건에 맞는 칸만 점을 찍는다
const dotsFor = (match, color) =>
  match
    ? (p) =>
        match.has(p.payload?.key) && p.cy != null ? (
          <circle key={p.index} cx={p.cx} cy={p.cy} r={3} fill={color} stroke="#FFFFFF" strokeWidth={0.8} />
        ) : (
          <g key={p.index} />
        )
    : false;

export default function LineView({ rows, lines, freq, match, onIndexAll }) {
  const panels = [];
  for (const l of lines) {
    const panel = panels.find((p) => p.unit === l.unitLabel);
    if (panel) panel.lines.push(l);
    else panels.push({ unit: l.unitLabel, lines: [l] });
  }
  const height = panels.length > 1 ? 230 : 360;
  // 모두 같은 '전년·평년 대비'인데 판이 나뉜 건 기온·강수(℃·mm 차이) 때문 — 지수로 바꾸라고 하지 않는다
  const relativeOnly = lines.every((l) => l.kind === lines[0].kind && (l.kind === 'yoy' || l.kind === 'normal'));

  return (
    <div className="space-y-5">
      {panels.length > 1 && (
        <p className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg bg-background-light px-3 py-2 text-xs text-subtext-light">
          <span className="material-symbols-outlined text-base text-primary">info</span>
          {relativeOnly ? (
            '기온·강수는 % 가 아니라 차이(℃·mm)로 비교해서 판을 나눴어요.'
          ) : (
            <>
              단위가 달라 판을 나눴어요. 한 판에 겹쳐 보려면
              <button type="button" onClick={onIndexAll} className="font-semibold text-primary hover:underline">
                모두 지수(시작=100)로 바꾸기
              </button>
            </>
          )}
        </p>
      )}
      {panels.map(({ unit, lines: list }) => {
        const base = BASELINE[list[0].kind];
        return (
          <div key={unit}>
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="font-semibold text-text-main">{unit || '값'}</span>
              {list.map((l) => (
                <span key={l.id} className="flex items-center gap-1 text-subtext-light">
                  <span className="inline-block h-0.5 w-3 rounded" style={{ background: colorOf(l.color) }} />
                  {l.name}
                  {l.lag ? ` (${lagLabel(l.lag, freq)})` : ''}
                </span>
              ))}
              {match && <span className="text-subtext-light">● 조건에 맞는 칸</span>}
            </div>
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={rows} syncId="workbench" margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={AXIS.grid} vertical={false} />
                <XAxis dataKey="key" tickFormatter={(k) => keyLabel(k, freq)} tick={AXIS.tick} minTickGap={28} />
                <YAxis tick={AXIS.tick} tickFormatter={tickNum} width={56} domain={['auto', 'auto']} />
                {base != null && <ReferenceLine y={base} stroke={AXIS.base} strokeDasharray="4 4" />}
                <Tooltip content={<LineTip lines={list} freq={freq} />} />
                {list.map((l) => (
                  <Line
                    key={l.id}
                    dataKey={(row) => row[l.id]}
                    name={l.name}
                    stroke={colorOf(l.color)}
                    strokeWidth={2}
                    dot={dotsFor(match, colorOf(l.color))}
                    activeDot={{ r: 4 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
