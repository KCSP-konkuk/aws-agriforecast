import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkline } from './HomeCharts';
import Icon from '../Icon';

export default function MarketStrip({ tiles }) {
  const [kind, setKind] = useState('retail');
  if (!tiles?.length) return null;
  const kinds = [{ key: 'retail', label: '전통시장 소매' }, { key: 'wholesale', label: '가락시장 도매' }];
  const availableKind = tiles.some((t) => t.kind === kind) ? kind : tiles[0].kind;
  const visible = tiles.filter((t) => t.kind === availableKind);
  return (
    <section id="market" aria-labelledby="market-title" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 id="market-title" className="section-title">품목별 가격 전망</h2><p className="mt-2 text-sm text-subtext-light">AI가 예상한 순 평균 가격을 확인하세요.</p></div>
        <div className="choice-tabs" role="group" aria-label="가격 기준">{kinds.map((k) => <button key={k.key} type="button" onClick={() => setKind(k.key)} aria-pressed={availableKind === k.key} disabled={!tiles.some((t) => t.kind === k.key)} className={`choice-tab ${availableKind === k.key ? 'choice-tab-active' : ''}`}>{k.label}<span className="text-xs tabular-nums">{tiles.filter((t) => t.kind === k.key).length}</span></button>)}</div>
      </div>
      <div className="mt-6 border-t border-text-main">
        <div className="hidden grid-cols-[1.1fr_1fr_.8fr_100px_1.3fr_20px] gap-6 border-b border-border-light px-1 py-3 text-xs text-subtext-light lg:grid" aria-hidden="true">
          <span>품목 / 예측 기간</span><span className="text-right">예측 평균가</span><span className="text-right">지난 순 대비</span><span>최근 흐름</span><span>주요 요인</span><span />
        </div>
        {visible.map((t) => {
          const tone = t.direction === 'up' ? 'text-price-up' : t.direction === 'down' ? 'text-price-down' : 'text-subtext-light';
          const pct = Number.isFinite(t.changePct) ? `${t.changePct > 0 ? '+' : t.changePct < 0 ? '−' : ''}${Math.abs(t.changePct).toFixed(1)}%` : '—';
          return (
            <Link key={`${t.kind}-${t.item}`} to={t.kind === 'retail' ? `/analysis/summary?item=${encodeURIComponent(t.item)}` : `/detail?item=${encodeURIComponent(t.item)}`} className="market-card grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-3 border-b border-border-light px-1 py-5 transition-colors hover:bg-background-light lg:grid-cols-[1.1fr_1fr_.8fr_100px_1.3fr_20px] lg:gap-6">
              <div><h3 className="text-[18px] font-medium">{t.item}</h3><p className="mt-1 text-xs text-subtext-light">{t.target} 예측</p></div>
              <div className="text-right"><span className="text-[26px] font-medium tracking-[-0.04em] tabular-nums">{t.predicted?.toLocaleString('ko-KR') ?? '—'}</span><span className="ml-1 text-xs text-subtext-light">원</span><p className="text-xs text-subtext-light">{t.unit ?? ''} 기준</p></div>
              <p className={`text-sm font-medium tabular-nums lg:text-right ${tone}`}>{pct}<span className="ml-2 text-xs font-normal text-subtext-light lg:hidden">지난 순 대비</span></p>
              <div className="w-20 justify-self-end lg:w-full" aria-hidden="true"><Sparkline values={t.spark} direction={t.direction} /></div>
              <p className="col-span-2 text-xs leading-relaxed text-subtext-light lg:col-span-1">{t.reason ? `${t.reason} · ${t.reasonDirection === 'up' ? '상승' : '하락'} 요인` : '농넷 가락시장 경매가 · 상 등급'}</p>
              <Icon className="hidden size-4 text-subtext-light lg:block" />
            </Link>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="data-note">{availableKind === 'retail' ? '서울 전통시장 경동·복조리 평균 · KAMIS' : '서울 가락시장 경매가 · 상 등급 · 농넷'} · 예측값은 실제 가격과 다를 수 있어요.</p><Link to={availableKind === 'retail' ? '/analysis/summary' : '/detail'} className="text-link">{availableKind === 'retail' ? '전망 자세히 보기' : '도매 시세 보기'}<Icon className="size-4" /></Link></div>
    </section>
  );
}
