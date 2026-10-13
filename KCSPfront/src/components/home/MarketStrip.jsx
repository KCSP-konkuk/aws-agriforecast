import { Link } from 'react-router-dom';
import { Sparkline } from './HomeCharts';

// 홈 · 다음 순 가격 — AI 소매 예측(인사이트 결론)과 도매 예측을 시세표처럼 한 줄씩.
// 줄마다 다음 순 예측가 · 등락 · 최근 12순 추이 · 가장 크게 작용한 요인. 소매는 오늘의 요약, 도매는 도매 예측 화면으로
const SIGN = { up: '+', down: '−' };
const TONE = { up: 'text-price-up', down: 'text-price-down' };

export default function MarketStrip({ tiles }) {
  if (!tiles?.length) return null;
  const target = tiles.find((t) => t.kind === 'retail')?.target ?? tiles[0].target;
  return (
    <section id="market" aria-labelledby="market-title" className="scroll-mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="market-title" className="text-xl font-bold tracking-[-0.02em] text-text-main">
          {target} 가격 예측
        </h2>
        <Link to="/analysis/summary" className="text-sm font-semibold text-primary hover:underline">
          오늘의 요약
        </Link>
      </div>
      <p className="mt-1 text-sm text-subtext-light">소매는 서울 전통시장(경동 · 복조리) 평균, 도매는 가락시장 경매가 · AI 예측</p>
      <table className="mt-3 w-full">
        <thead>
          <tr className="border-b border-border-light text-left text-[13px] text-subtext-light">
            <th scope="col" className="py-2 font-medium">품목</th>
            <th scope="col" className="py-2 text-right font-medium">예측가</th>
            <th scope="col" className="py-2 text-right font-medium">지난 순 대비</th>
            <th scope="col" className="hidden py-2 pl-6 font-medium sm:table-cell">최근 12순</th>
            <th scope="col" className="hidden py-2 pl-4 font-medium md:table-cell">가장 큰 요인</th>
          </tr>
        </thead>
        <tbody>
          {tiles.map((t) => {
            const to = t.kind === 'retail' ? `/analysis/summary?item=${encodeURIComponent(t.item)}` : `/detail?item=${encodeURIComponent(t.item)}`;
            return (
              <tr key={`${t.kind}-${t.item}`} className="group border-b border-line last:border-0">
                <th scope="row" className="py-3 text-left">
                  <Link to={to} className="text-[15px] font-semibold text-text-main group-hover:text-primary">
                    {t.item}
                  </Link>
                  <span className="ml-1.5 text-xs text-subtext-light">{t.kind === 'retail' ? '소매' : '도매'}</span>
                </th>
                <td className="py-3 text-right text-[15px] font-semibold tabular-nums text-text-main">
                  {t.predicted.toLocaleString('ko-KR')}
                  <span className="ml-1 text-xs font-normal text-subtext-light">원{t.unit ? `/${t.unit}` : ''}</span>
                </td>
                <td className={`py-3 text-right text-[15px] font-semibold tabular-nums ${TONE[t.direction] ?? 'text-subtext-light'}`}>
                  {SIGN[t.direction] ?? ''}{Math.abs(t.changePct).toFixed(1)}%
                </td>
                <td className="hidden w-36 py-2 pl-6 sm:table-cell">
                  <Sparkline values={t.spark} direction={t.direction} />
                </td>
                <td className="hidden py-3 pl-4 text-sm text-subtext-light md:table-cell">
                  {t.reason ? `${t.reason} ${t.reasonDirection === 'up' ? '오름' : '내림'}` : '가락 경매가 예측'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
