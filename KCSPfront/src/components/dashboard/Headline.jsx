import { DIRECTION, signedPct, won } from './format';

// 지난 예측이 얼마나 맞았나 — 3순 넘게 쌓이면 평균 오차와 방향 적중, 그 전엔 쌓는 중이라고만
function TrackRecord({ track }) {
  if (!track) return null;
  if (track.n < 3) {
    return <p className="text-xs text-subtext-light mt-2">예측 기록을 쌓는 중이에요({track.since}부터 {track.n}순). 3순이 넘으면 얼마나 맞았는지 보여 드려요.</p>;
  }
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white/70 px-3 py-2 text-sm text-text-main">
      <span className="material-symbols-outlined text-lg text-primary">fact_check</span>
      지난 {track.n}순 예측 · 평균 오차 <b>{track.mape}%</b>
      {track.judged > 0 && (
        <>
          · 오름·내림 방향 <b>{track.hits}/{track.judged}</b> 맞힘
        </>
      )}
      <span className="text-xs text-subtext-light">({track.since}부터)</span>
    </p>
  );
}

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
      <TrackRecord track={data.track} />
    </section>
  );
}
