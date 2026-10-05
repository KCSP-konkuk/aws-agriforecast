import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardCard from './DashboardCard';
import { COLOR } from './format';

function BoardTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const a = payload[0].payload;
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow px-3 py-2 text-xs">
      <p className="font-semibold text-text-main">{a.label}</p>
      <p className="text-subtext-light">
        {a.basis} {a.valueText && <b className="text-text-main">{a.valueText}</b>} · {a.level}
      </p>
      {a.asOf && <p className="text-subtext-light">{a.asOf} 자료</p>}
    </div>
  );
}

// ③ 지금 상황판 — 지표마다 과거 대비 위치(가운데 낮음 · 바깥 높음)와 가격이 크게 오르기 직전의 평균 모양
export default function SituationBoard({ data, actions }) {
  const { axes, similarity, note } = data.board;
  const hasSurge = axes.some((a) => a.surge != null);

  return (
    <DashboardCard
      icon="radar"
      actions={actions}
      title="지금 상황판"
      subtitle="지표마다 과거와 비교한 위치예요. 가운데가 낮음, 바깥이 높음, 중간이 보통이에요"
    >
      {axes.length < 3 ? (
        <p className="text-sm text-subtext-light">비교할 지표가 아직 충분하지 않아요.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={axes} outerRadius="70%">
              <PolarGrid stroke={COLOR.grid} />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: COLOR.main }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              {hasSurge && (
                <Radar dataKey="surge" stroke={COLOR.up} fill={COLOR.up} fillOpacity={0.04} strokeDasharray="4 3" />
              )}
              <Radar dataKey="score" stroke={COLOR.primary} fill={COLOR.primary} fillOpacity={0.25} />
              <Tooltip content={<BoardTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-4 text-xs text-subtext-light">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm" style={{ background: COLOR.primary, opacity: 0.5 }} />
              지금
            </span>
            {hasSurge && (
              <span className="flex items-center gap-1.5">
                <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke={COLOR.up} strokeWidth="2" strokeDasharray="4 3" /></svg>
                가격이 크게 오르기 직전 평균
              </span>
            )}
          </div>
          <p className="text-sm text-text-main mt-3">
            {similarity != null && (
              <>
                지금 모습은 가격이 크게 오르기 직전과 <b>{Math.round(similarity * 100)}%</b> 닮았어요.{' '}
              </>
            )}
            {note}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {axes.map((a) => (
              <li key={a.key} className="rounded-lg bg-background-light px-3 py-2">
                <p className="text-xs text-subtext-light">{a.label}</p>
                <p className="text-sm font-semibold text-text-main">
                  {a.valueText || a.level}
                  {a.valueText && (
                    <span className={`ml-1 text-[11px] font-medium ${a.level === '보통' ? 'text-subtext-light' : 'text-text-main'}`}>
                      {a.level}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardCard>
  );
}
