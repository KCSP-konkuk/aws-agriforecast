import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/api';
import StatusMessage from '../StatusMessage';
import { DIRECTION, signedPct, won } from '../dashboard/format';

// 홈 · 오늘의 요약 — 품목마다 다음 순 한 줄 결론(인사이트 배치, 매일 12:40 KST). 누르면 그 품목 요약 화면
// 품목 목록은 API 에서 받는다. 아직 계산 전인 품목은 뺀다
export default function SummaryCards() {
  const [state, setState] = useState({ status: 'loading', cards: [] });

  useEffect(() => {
    let alive = true;
    api
      .getDashboardItems()
      .then((items) => Promise.all(items.map((it) => api.getDashboard(it.item).catch(() => null))))
      .then((list) => alive && setState({ status: 'ready', cards: list.filter(Boolean) }))
      .catch(() => alive && setState({ status: 'error', cards: [] }));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-text-main">오늘의 요약</h2>
          <p className="mt-0.5 text-xs text-subtext-light">서울 전통시장 소매가 · 다음 순 한 줄 결론 · 매일 낮 12시 40분 갱신</p>
        </div>
        <Link to="/analysis/summary" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          자세히 보기
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </Link>
      </div>
      {state.status !== 'ready' || state.cards.length === 0 ? (
        <StatusMessage
          status={state.status}
          loadingText="요약을 불러오는 중이에요"
          emptyText="아직 계산된 요약이 없어요. 매일 낮 12시 40분에 갱신돼요."
          errorText="요약을 불러오지 못했어요."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.cards.map((d) => {
            const h = d.headline;
            const dir = DIRECTION[h.direction] ?? DIRECTION.flat;
            return (
              <Link
                key={d.item}
                to={`/analysis/summary?item=${encodeURIComponent(d.item)}`}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary">{d.item}</span>
                  <span className="text-[11px] text-subtext-light">{d.targetLabel}</span>
                </div>
                <div className="mt-2 flex items-start gap-2">
                  <span className={`material-symbols-outlined text-2xl ${dir.text}`}>{dir.icon}</span>
                  <p className="font-semibold leading-snug text-text-main">{h.text}</p>
                </div>
                {h.reason && <p className="mt-1 line-clamp-2 text-xs text-subtext-light">{h.reason}</p>}
                <p className="mt-auto pt-3 text-sm text-subtext-light">
                  예측 <b className={dir.text}>{won(h.predicted)}</b> ({signedPct(h.changePct, 1)}){d.unit ? ` · ${d.unit}` : ''}
                </p>
                {d.track?.n >= 3 && (
                  <p className="text-[11px] text-subtext-light">
                    지난 {d.track.n}순 평균 오차 {d.track.mape}%{d.track.judged > 0 ? ` · 방향 ${d.track.hits}/${d.track.judged}` : ''}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
