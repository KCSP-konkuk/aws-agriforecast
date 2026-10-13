import { DIRECTION, signedPct, won } from './format';

// 지난 예측이 얼마나 맞았나 — 3순 넘게 쌓이면 평균 오차와 방향 적중, 그 전엔 쌓는 중이라고만
function TrackRecord({ track }) {
  if (!track) return null;
  if (track.n < 3) {
    return <p className="text-xs text-subtext-light mt-2">예측 기록을 쌓는 중이에요({track.since}부터 {track.n}순). 3순이 넘으면 얼마나 맞았는지 보여 드려요.</p>;
  }
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border-light pt-3 text-sm text-text-main">
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
    <section className="rounded-[24px] border border-primary/10 bg-primary-light p-6 sm:p-8">
      <div className="grid items-center gap-7 lg:grid-cols-[1fr_auto]">
        <div>
          <span className="pill !border-primary/15 !bg-white/60 !text-primary">{data.targetLabel} · AI 가격 전망</span>
          <h2 className="mt-4 max-w-xl text-[24px] font-semibold leading-snug tracking-[-0.035em] text-forest sm:text-[30px]">{h.text}</h2>
          {h.reason && <p className="mt-3 text-[15px] leading-relaxed text-subtext-light">{h.reason}</p>}
        </div>
        <dl className="min-w-0 border-t border-primary/15 pt-5 lg:min-w-[240px] lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <dt className="text-sm text-primary">{data.targetLabel} 예상 평균가</dt>
          <dd className="mt-1 text-[38px] font-semibold leading-tight tracking-[-0.05em] tabular-nums text-forest sm:text-[44px]">{won(h.predicted)}</dd>
          <dd className="mt-1 text-sm text-subtext-light">{data.unit} 기준</dd>
          <dd className={`mt-4 text-[17px] font-semibold tabular-nums ${d.text}`}>{signedPct(h.changePct, 1)}<span className="ml-2 text-xs font-normal text-subtext-light">지난 순 대비</span></dd>
          <dd className="mt-1 text-xs text-subtext-light">{data.previousLabel} 평균 {won(h.previous)}</dd>
        </dl>
      </div>
      {h.source !== 'retail_model' && <p className="mt-4 text-xs text-subtext-light">이번 순 운영 예측이 아직 없어 요약 계산값을 보여드려요.</p>}
      <TrackRecord track={data.track} />
    </section>
  );
}
