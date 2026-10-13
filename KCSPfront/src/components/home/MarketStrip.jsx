import { Link } from 'react-router-dom';
import { Sparkline } from './HomeCharts';

// 홈 · 오늘의 시장 — AI 소매 예측(인사이트 결론)과 도매 예측을 칸으로. 칸마다 다음 순 예측가 · 등락 · 최근 12순 추이 · 가장 큰 요인.
// 값은 배치(home_highlights)가 매일 모은다. 소매는 오늘의 요약, 도매는 도매 예측 화면으로 이어진다
const ARROW = { up: '▲', down: '▼', flat: '–' };
const TONE = { up: 'text-price-up', down: 'text-price-down', flat: 'text-subtext-light' };

export default function MarketStrip({ tiles }) {
  if (!tiles?.length) return null;
  const target = tiles.find((t) => t.kind === 'retail')?.target ?? tiles[0].target;
  return (
    <section id="market" aria-labelledby="market-title" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="market-title" className="text-lg font-bold text-text-main">
          다음 순 가격 · AI 예측
        </h2>
        <span className="text-xs font-semibold text-subtext-light">{target} · 소매 서울 전통시장 · 도매 가락시장</span>
        <Link to="/analysis/summary" className="text-xs font-bold text-primary hover:underline">
          오늘의 요약 →
        </Link>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {tiles.map((t) => (
          <li key={`${t.kind}-${t.item}`}>
            <Link
              to={t.kind === 'retail' ? `/analysis/summary?item=${encodeURIComponent(t.item)}` : `/detail?item=${encodeURIComponent(t.item)}`}
              className="flex h-full flex-col gap-1 rounded-lg border border-border-light bg-white p-2.5 transition hover:border-primary/40"
            >
              <span className="flex items-baseline justify-between gap-1">
                <span className="truncate text-sm font-bold text-text-main">
                  {t.item} <span className="text-[11px] font-semibold text-subtext-light">{t.kind === 'retail' ? '소매' : '도매'}</span>
                </span>
                <span className={`shrink-0 text-xs font-semibold tabular-nums ${TONE[t.direction] ?? TONE.flat}`}>
                  {ARROW[t.direction] ?? ARROW.flat} {Math.abs(t.changePct).toFixed(1)}%
                </span>
              </span>
              <Sparkline values={t.spark} direction={t.direction} />
              <span className="text-sm font-semibold tabular-nums text-text-main">
                {t.predicted.toLocaleString('ko-KR')}원 {t.unit && <span className="text-[11px] font-medium text-subtext-light">/{t.unit}</span>}
              </span>
              <span className="self-start truncate rounded-full bg-background-light px-2 py-px text-[11px] text-subtext-light">
                {t.reason ? `${t.reason} ${t.reasonDirection === 'up' ? '↑' : '↓'}` : '가락 경매가 예측'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
