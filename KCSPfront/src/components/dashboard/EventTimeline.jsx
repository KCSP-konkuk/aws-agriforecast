import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardCard from './DashboardCard';
import { COLOR, won } from './format';

// 사건 종류별 점 색 — 가격·도매는 진한 색, 이종 데이터는 종류마다 다른 색
const KIND_COLOR = {
  price: COLOR.main,
  wholesale: COLOR.primary,
  supply: COLOR.accent,
  weather: COLOR.down,
  fx: COLOR.up,
};

function TimelineTooltip({ active, payload, events, unit }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  const here = events.filter((e) => e.soon === s.soon);
  return (
    <div className="rounded-lg bg-white border border-border-light shadow px-3 py-2 text-xs max-w-[240px]">
      <p className="font-semibold text-text-main">{s.label}</p>
      <p className="text-subtext-light">
        소매가 <b className="text-text-main">{won(s.retail)}</b> {unit}
      </p>
      {here.map((e) => (
        <p key={e.title} className="text-text-main mt-1">· {e.title}: {e.text}</p>
      ))}
    </div>
  );
}

// ④ 무슨 일이 있었나 — 최근 2년 소매가와 자동 감지한 사건
export default function EventTimeline({ data, actions }) {
  const { series, events } = data.timeline;
  const bySoon = Object.fromEntries(series.map((s) => [s.soon, s]));
  const dots = events.filter((e) => bySoon[e.soon]?.retail != null);

  return (
    <DashboardCard actions={actions} title="무슨 일이 있었나" subtitle="최근 2년 소매가 흐름과 그 사이 있었던 일이에요. 점에 마우스를 올리면 내용이 보여요">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={COLOR.grid} strokeOpacity={0.5} vertical={false} />
          <XAxis dataKey="soon" tickFormatter={(v) => bySoon[v]?.label ?? v} interval={11} tick={{ fontSize: 12, fill: COLOR.sub }} />
          <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 12, fill: COLOR.sub }} width={56} domain={['auto', 'auto']} />
          <Tooltip content={<TimelineTooltip events={events} unit={data.unit} />} />
          <Line type="monotone" dataKey="retail" stroke={COLOR.primary} strokeWidth={2} dot={false} connectNulls />
          {dots.map((e) => (
            <ReferenceDot
              key={`${e.soon}-${e.title}`}
              x={e.soon}
              y={bySoon[e.soon].retail}
              r={5}
              fill={KIND_COLOR[e.kind] ?? COLOR.main}
              stroke="#fff"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {events.length === 0 ? (
        <p className="text-sm text-subtext-light mt-3">최근 2년 동안 눈에 띄는 일이 없었어요.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {[...events].reverse().map((e) => (
            <li key={`${e.soon}-${e.title}`} className="flex gap-3 py-3 sm:gap-4">
              <p className="flex w-24 shrink-0 items-center gap-2 self-start text-[13px] text-subtext-light sm:w-28">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[e.kind] ?? COLOR.main }} />
                {e.label}
              </p>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-text-main">{e.title}</p>
                <p className="mt-0.5 text-sm text-text-main">{e.text}</p>
                {e.afterText && <p className="mt-0.5 text-[13px] text-subtext-light">{e.afterText}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
