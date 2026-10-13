import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import DashboardCard from './DashboardCard';
import { COLOR, signedPct } from './format';

// ⑤ 비슷했던 과거 — 같은 계절에서 지표가 가장 비슷했던 순과 그 뒤 가격
export default function AnalogCards({ data, actions }) {
  const { items, summary } = data.analogs;
  return (
    <DashboardCard actions={actions} title="비슷했던 과거" subtitle="같은 계절에서 지금과 상황이 가장 비슷했던 때와, 그 뒤 소매가예요">
      {items.length === 0 ? (
        <p className="text-sm text-subtext-light">비교할 만큼 비슷한 때를 찾지 못했어요.</p>
      ) : (
        <>
          <p className="mb-3 text-[15px] font-semibold text-text-main">{summary}</p>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((a) => {
              const color = a.next > 0 ? 'text-price-up' : a.next < 0 ? 'text-price-down' : 'text-text-main';
              return (
                <li key={a.soon} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-text-main">{a.label}</p>
                    <p className="text-[13px] text-subtext-light">닮은 정도 {Math.round(a.similarity * 100)}%</p>
                  </div>
                  <div className="h-10 w-24 shrink-0" aria-hidden="true">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={a.path.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <YAxis hide domain={['auto', 'auto']} />
                        <Line dataKey="v" stroke={COLOR.sub} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    <p className="text-xs text-subtext-light">그다음 순</p>
                    <p className={`text-base font-bold ${color}`}>{signedPct(a.next)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-subtext-light">가운데 선은 그 뒤 세 순의 소매가 흐름이에요.</p>
        </>
      )}
    </DashboardCard>
  );
}
