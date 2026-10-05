import DashboardCard from './DashboardCard';
import { COLOR, signedPct, tint } from './format';

const SOON = ['상순', '중순', '하순'];
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);

// ⑥ 앞으로의 흐름 — 도매가가 소매가에 반영되는 시차와 1년 가격 달력(평년 기준)
export default function FlowPanel({ data, actions }) {
  const f = data.flow;
  const cal = f.calendar ?? [];
  const max = Math.max(0.01, ...cal.filter((v) => v != null).map(Math.abs));
  const cellColor = (v) => {
    if (v == null) return tint(COLOR.grid, 0.6);
    const a = 0.12 + 0.75 * Math.min(Math.abs(v) / max, 1);
    return tint(v >= 0 ? COLOR.up : COLOR.down, a);
  };
  const strong = f.linked && f.lagDays != null;   // 도매·소매가 뚜렷하게 같이 움직일 때만 시차를 크게 보여 준다

  return (
    <DashboardCard icon="timeline" actions={actions} title="앞으로의 흐름" subtitle={`${data.wholesaleLabel}와 소매가의 관계, 1년 중 가격이 오르내리는 시기예요`}>
      <div className="rounded-lg bg-background-light p-4">
        {strong && (
          <p className="text-xs text-subtext-light">
            {data.wholesaleName} → 소매가 반영까지 <span className="block text-2xl font-bold text-primary">약 {f.lagDays}일</span>
          </p>
        )}
        {!strong && f.text && <p className="text-sm text-text-main">{f.text}</p>}
        {f.signal && (
          <p className="text-sm text-text-main mt-2 flex gap-2">
            <span className="material-symbols-outlined text-primary text-lg">notifications</span>
            <span>{f.signal}</span>
          </p>
        )}
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-text-main">
          1년 가격 달력 <span className="text-xs font-normal text-subtext-light">평년 기준 · 파랑은 싼 때, 빨강은 비싼 때</span>
        </p>
        <div className="grid grid-cols-[repeat(36,minmax(0,1fr))] gap-[2px] mt-2">
          {cal.map((v, i) => (
            <div
              key={i}
              title={`${Math.floor(i / 3) + 1}월 ${SOON[i % 3]} · 연평균보다 ${signedPct(v)}`}
              className={`h-6 rounded-sm ${i === f.current ? 'ring-2 ring-text-main ring-offset-1' : ''}`}
              style={{ background: cellColor(v) }}
            />
          ))}
        </div>
        <div className="grid grid-cols-12 text-[11px] text-subtext-light mt-1">
          {MONTHS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <p className="text-xs text-subtext-light mt-1">테두리 칸이 이번 순({data.targetLabel})이에요.</p>
        {f.calendarText && <p className="text-sm text-text-main mt-2">{f.calendarText}</p>}
      </div>
    </DashboardCard>
  );
}
