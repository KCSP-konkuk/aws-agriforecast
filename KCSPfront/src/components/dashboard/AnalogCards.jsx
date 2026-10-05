import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import DashboardCard from './DashboardCard';
import { COLOR, signedPct } from './format';

// ⑤ 비슷했던 과거 — 같은 계절에서 지표가 가장 비슷했던 순과 그 뒤 가격
export default function AnalogCards({ data, actions }) {
  const { items, summary } = data.analogs;
  return (
    <DashboardCard icon="history" actions={actions} title="비슷했던 과거" subtitle="같은 계절에서 지금과 상황이 가장 비슷했던 때와, 그 뒤 소매가예요">
      {items.length === 0 ? (
        <p className="text-sm text-subtext-light">비교할 만큼 비슷한 때를 찾지 못했어요.</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-text-main mb-3">{summary}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {items.map((a) => {
              const color = a.next > 0 ? 'text-price-up' : a.next < 0 ? 'text-price-down' : 'text-text-main';
              return (
                <div key={a.soon} className="rounded-lg border border-gray-100 p-3">
                  <p className="text-xs text-subtext-light">{a.label}</p>
                  <p className="text-[11px] text-subtext-light">닮은 정도 {Math.round(a.similarity * 100)}%</p>
                  <p className={`text-base font-bold mt-1 ${color}`}>그다음 순 {signedPct(a.next)}</p>
                  <div className="h-12 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={a.path.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <YAxis hide domain={['auto', 'auto']} />
                        <Line dataKey="v" stroke={COLOR.sub} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-subtext-light">그 뒤 세 순 흐름</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DashboardCard>
  );
}
