import { DIRECTION, signedPct, won } from './format';

// ① 한 줄 결론 — 다음 순 방향과 가장 크게 작용한 요인
export default function Headline({ data }) {
  const h = data.headline;
  const d = DIRECTION[h.direction] ?? DIRECTION.flat;
  return (
    <section className="rounded-xl p-5 sm:p-6 bg-primary-light border border-primary/20">
      <p className="text-xs font-semibold text-primary">{data.targetLabel} 한 줄 결론</p>
      <div className="flex items-start gap-3 mt-2">
        <span className={`material-symbols-outlined text-4xl ${d.text}`}>{d.icon}</span>
        <div className="min-w-0">
          <p className="text-xl sm:text-2xl font-bold text-text-main leading-snug">{h.text}</p>
          {h.reason && <p className="text-sm text-text-main mt-1">{h.reason}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm text-subtext-light">
        <span>
          {data.previousLabel} 평균 <b className="text-text-main">{won(h.previous)}</b>
        </span>
        <span>
          {data.targetLabel} 예측 <b className={d.text}>{won(h.predicted)}</b> ({signedPct(h.changePct, 1)})
        </span>
        {data.unit && <span>{data.unit} 기준</span>}
      </div>
      {h.source !== 'retail_model' && (
        <p className="text-xs text-subtext-light mt-2">이번 순 운영 예측이 아직 없어 요약 계산값을 보여드려요.</p>
      )}
    </section>
  );
}
