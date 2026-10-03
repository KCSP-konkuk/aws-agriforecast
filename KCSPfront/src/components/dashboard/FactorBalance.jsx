import DashboardCard from './DashboardCard';
import { COLOR, won } from './format';

const STRENGTH_CLASS = {
  크게: 'bg-text-main text-white',
  보통: 'bg-gray-200 text-text-main',
  조금: 'bg-gray-100 text-subtext-light',
};

// 한쪽(올리는 힘 / 내리는 힘)의 막대 조각. 큰 쪽이 자기 절반을 다 채운다
function Side({ factors, color, scale, align }) {
  return (
    <div className={`flex h-full w-1/2 ${align === 'right' ? 'justify-end' : ''}`}>
      {factors.map((f, i) => (
        <div
          key={f.key}
          title={`${f.label} · 약 ${won(Math.abs(f.amount))}`}
          className="h-full border-x border-white"
          style={{ width: `${(Math.abs(f.amount) / scale) * 100}%`, background: color, opacity: Math.max(0.35, 1 - i * 0.2) }}
        />
      ))}
    </div>
  );
}

// ② 가격을 움직이는 요인 — 올리는 힘과 내리는 힘을 양쪽에 놓은 저울과 요인 3가지
export default function FactorBalance({ data }) {
  const shown = data.factors.filter((f) => !f.negligible);
  const up = shown.filter((f) => f.direction === 'up');
  const down = shown.filter((f) => f.direction === 'down');
  const total = (list) => list.reduce((s, f) => s + Math.abs(f.amount), 0);
  const scale = Math.max(total(up), total(down)) || 1;
  const top = shown.filter((f) => f.top);

  return (
    <DashboardCard
      icon="balance"
      title="가격을 움직이는 요인"
      subtitle={`${data.targetLabel} 예측에서 모델이 무게를 둔 요인이에요. 막대에 마우스를 올리면 크기가 보여요`}
    >
      <div className="flex items-center justify-between text-xs font-semibold mb-1">
        <span className="text-price-down">내리는 힘</span>
        <span className="text-price-up">올리는 힘</span>
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
        {/* 내리는 힘은 가운데에서 왼쪽으로, 올리는 힘은 오른쪽으로 쌓인다 */}
        <Side factors={down} color={COLOR.down} scale={scale} align="right" />
        <div className="w-px bg-gray-400" />
        <Side factors={up} color={COLOR.up} scale={scale} align="left" />
      </div>

      {top.length === 0 ? (
        <p className="text-sm text-subtext-light mt-4">이번 순은 눈에 띄게 작용하는 요인이 없어요.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {top.map((f) => (
            <li key={f.key} className="flex items-start gap-3" title={`약 ${f.direction === 'up' ? '+' : '−'}${won(Math.abs(f.amount))} (직전 순 가격 기준)`}>
              <span className={`material-symbols-outlined ${f.direction === 'up' ? 'text-price-up' : 'text-price-down'}`}>
                {f.direction === 'up' ? 'arrow_upward' : 'arrow_downward'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-main">
                  {f.label}
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium ${STRENGTH_CLASS[f.strength] ?? ''}`}>
                    {f.strength} {f.direction === 'up' ? '올림' : '내림'}
                  </span>
                </p>
                {f.evidence && <p className="text-xs text-subtext-light mt-0.5">{f.evidence}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {shown.length < data.factors.length && (
        <p className="text-xs text-subtext-light mt-3">그 밖의 요인은 영향이 거의 없어요.</p>
      )}
    </DashboardCard>
  );
}
