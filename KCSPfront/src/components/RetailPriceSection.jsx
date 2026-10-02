import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/api';
import StatusMessage from './StatusMessage';

const COLOR_ACTUAL = '#4A90E2';
const COLOR_PRED = '#F59E0B';

const won = (v) => (v == null ? '-' : `${v.toLocaleString()}원`);

// "2026-09-23" → "9/23"
const shortDate = (iso) => {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
};

// "202610상순" → "10월 상순"
const targetLabel = (code) => (code ? `${Number(code.slice(4, 6))}월 ${code.slice(6)}` : '');

function ChangeText({ pct }) {
  if (pct == null) return <span className="text-subtext-light">지난 순 평균 대비 -</span>;
  const color = pct > 0 ? 'text-price-up' : pct < 0 ? 'text-price-down' : 'text-text-main';
  const mark = pct > 0 ? '▲' : pct < 0 ? '▼' : '―';
  return (
    <span className="text-subtext-light">
      지난 순 평균 대비 <span className={`font-semibold ${color}`}>{mark} {Math.abs(pct)}%</span>
    </span>
  );
}

function ItemCard({ item, selected, onSelect }) {
  const empty = item.latestPrice == null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${CARD_WIDTH} shrink-0 snap-start text-left rounded-xl p-4 bg-white border transition ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200 hover:border-primary/50'
      }`}
    >
      <p className="text-sm font-semibold text-text-main">
        {item.itemName} <span className="text-xs font-normal text-subtext-light">{item.unit}</span>
      </p>
      {empty ? (
        <p className="text-lg font-bold text-subtext-light mt-2">데이터 없음</p>
      ) : (
        <>
          <p className="text-2xl font-bold text-text-main mt-1">{won(item.latestPrice)}</p>
          <p className="text-xs mt-1"><ChangeText pct={item.changePct} /></p>
          <p className="text-xs text-subtext-light mt-0.5">{shortDate(item.latestDate)} 기준</p>
        </>
      )}
      <p className="text-xs text-subtext-light mt-3 pt-2 border-t border-gray-100">
        {item.prediction
          ? <>{targetLabel(item.prediction.target)} 예측 <span className="font-semibold" style={{ color: COLOR_PRED }}>{won(item.prediction.price)}</span></>
          : '다음 순 예측 · 준비 중'}
      </p>
    </button>
  );
}

// 한 줄에 보이는 카드: 모바일 2장 · sm 이상 3장, 다음 카드가 살짝 보여 넘길 게 있다는 걸 알린다
const CARD_WIDTH = 'w-[44%] sm:w-[31%]';

// 품목 카드 한 줄. 자동으로 넘기지 않는다 — 고른 카드가 밀려나면 아래 차트와 어긋난다.
// 모바일은 손으로 밀고(카드 단위로 멈춤), sm 이상은 좌우 화살표. 넘칠 때만 화살표를 보인다
function CardRow({ children }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update, children]);

  const step = (dir) => {
    const el = ref.current;
    const card = el?.firstElementChild;
    if (!card) return;
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 12), behavior: 'smooth' });
  };

  const arrow = (dir, show) => show && (
    <button
      type="button"
      onClick={() => step(dir)}
      aria-label={dir < 0 ? '이전 품목' : '다음 품목'}
      className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${dir < 0 ? '-left-3' : '-right-3'} z-10 w-8 h-8 items-center justify-center rounded-full bg-white border border-gray-200 shadow text-text-main hover:border-primary/50`}
    >
      <span className="material-symbols-outlined text-xl">{dir < 0 ? 'chevron_left' : 'chevron_right'}</span>
    </button>
  );

  return (
    <div className="relative mb-4">
      {arrow(-1, edge.left)}
      <div
        ref={ref}
        onScroll={update}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory p-1 -m-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {arrow(1, edge.right)}
    </div>
  );
}

// 예측 칸에만 점. 예측선 시작점(bridge — 직전 실측과 같은 값)에는 평소에도, 마우스를 올려도 그리지 않는다
function PredDot({ cx, cy, payload, active = false }) {
  if (cx == null || cy == null || payload?.bridge || payload?.predicted == null) return null;
  return <circle cx={cx} cy={cy} r={active ? 6 : 5} fill={COLOR_PRED} stroke="#fff" strokeWidth={1.5} />;
}

function SeriesTooltip({ active, payload, unit, isSoon }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow px-3 py-2 text-xs">
      <p className="font-semibold text-text-main mb-1">{p.label}</p>
      {p.price != null && <p className="text-text-main"><span style={{ color: COLOR_ACTUAL }}>●</span> {won(p.price)} / {unit}{p.predicted != null && !p.bridge ? ' (진행 중)' : ''}</p>}
      {p.predicted != null && !p.bridge && <p className="text-text-main"><span style={{ color: COLOR_PRED }}>●</span> 예측 {won(p.predicted)}</p>}
      {isSoon && p.days != null && <p className="text-subtext-light mt-1">조사 {p.days}일</p>}
    </div>
  );
}

export default function RetailPriceSection() {
  const [summary, setSummary] = useState({ status: 'loading', data: [] });
  const [selected, setSelected] = useState(null);
  const [unit, setUnit] = useState('soon');
  const [series, setSeries] = useState({ status: 'loading', data: null });

  useEffect(() => {
    api.getRetailSummary()
      .then((data) => {
        setSummary({ status: 'ready', data });
        if (data.length > 0) setSelected(data[0].itemName);
      })
      .catch(() => setSummary({ status: 'error', data: [] }));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setSeries({ status: 'loading', data: null });
    api.getRetailSeries(selected, unit)
      .then((data) => { if (!cancelled) setSeries({ status: 'ready', data }); })
      .catch(() => { if (!cancelled) setSeries({ status: 'error', data: null }); });
    return () => { cancelled = true; };
  }, [selected, unit]);

  const isSoon = unit === 'soon';
  const predictions = isSoon ? (series.data?.predictions ?? []) : [];

  // 실제값 점 + (순별이면) 예측 점. 예측 대상 직전의 실제 점을 예측선 시작점으로 잇는다.
  // 예측 대상이 진행 중인 순이면 그 칸에 실제(진행 중)와 예측을 같이 둔다 — 같은 라벨을 두 번 붙이지 않는다
  const chartData = useMemo(() => {
    const points = (series.data?.points ?? []).map((p) => ({ label: p.label, price: p.price, days: p.days }));
    if (predictions.length === 0 || points.length === 0) return points;
    const extra = [];
    predictions.forEach((p) => {
      const same = points.find((x) => x.label === p.label);
      if (same) same.predicted = p.price;
      else extra.push({ label: p.label, predicted: p.price });
    });
    const firstPred = points.findIndex((x) => x.predicted != null);
    const bridge = points[(firstPred === -1 ? points.length : firstPred) - 1];
    if (bridge) {
      bridge.predicted = bridge.price;
      bridge.bridge = true;
    }
    return [...points, ...extra];
  }, [series.data, predictions]);

  const unitLabel = series.data?.unit ?? '';

  return (
    <section>
      <div className="pb-3 pt-5">
        <h2 className="text-text-main text-[22px] font-bold leading-tight">서울 전통시장 소매가</h2>
        <p className="text-xs text-subtext-light mt-1">KAMIS Open API · 경동·복조리 평균 · 상품 등급 · 매일 갱신</p>
      </div>

      {summary.status === 'loading' ? (
        <div className="flex gap-3 overflow-hidden mb-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`${CARD_WIDTH} shrink-0 h-40 rounded-xl bg-background-light animate-pulse`} />)}
        </div>
      ) : summary.status === 'error' ? (
        <StatusMessage status="error" errorText="소매가 데이터를 불러오지 못했습니다." />
      ) : (
        <>
          <CardRow>
            {summary.data.map((item) => (
              <ItemCard
                key={item.itemName}
                item={item}
                selected={item.itemName === selected}
                onSelect={() => setSelected(item.itemName)}
              />
            ))}
          </CardRow>

          <div className="rounded-xl p-4 sm:p-5 bg-white border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-text-main">{selected} 소매가 추이</h3>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-subtext-light">
                  <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={COLOR_ACTUAL} strokeWidth="2" /></svg>
                  실제
                </span>
                {isSoon && predictions.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-subtext-light">
                    <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={COLOR_PRED} strokeWidth="2" strokeDasharray="4 3" /></svg>
                    예측
                  </span>
                )}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  {[['daily', '일별'], ['soon', '순별']].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUnit(key)}
                      className={`px-3 py-1 ${unit === key ? 'bg-primary text-white' : 'bg-white text-text-main hover:bg-background-light'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {series.status === 'loading' ? (
              <div className="h-64 rounded-lg bg-background-light animate-pulse" />
            ) : series.status === 'error' ? (
              <StatusMessage status="error" errorText="소매가 추이를 불러오지 못했습니다." />
            ) : chartData.length === 0 ? (
              <StatusMessage status="ready" emptyText="아직 수집된 소매가가 없습니다." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                  <XAxis
                    dataKey="label"
                    tickFormatter={(l) => (isSoon ? l.slice(2) : shortDate(l))}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    minTickGap={24}
                  />
                  <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 11, fill: '#64748B' }} width={56} domain={['auto', 'auto']} />
                  <Tooltip content={<SeriesTooltip unit={unitLabel} isSoon={isSoon} />} />
                  <Line type="monotone" dataKey="price" stroke={COLOR_ACTUAL} strokeWidth={2}
                        dot={isSoon ? { r: 2.5, fill: COLOR_ACTUAL } : false} activeDot={{ r: 4 }} connectNulls={false} />
                  {predictions.length > 0 && (
                    <Line type="monotone" dataKey="predicted" stroke={COLOR_PRED} strokeWidth={2}
                          strokeDasharray="5 4" dot={<PredDot />} activeDot={<PredDot active />} connectNulls={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </section>
  );
}
