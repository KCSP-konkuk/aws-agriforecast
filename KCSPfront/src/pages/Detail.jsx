import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PredictionHistory from '../components/PredictionHistory';
import { api } from '../api/api';
import { toLocalDate } from '../date';

// 실제 = 진한 회색 실선, AI 예측 = 브랜드 초록 점선 (PredictionHistory 와 같은 색)
const COLOR_ACTUAL = '#191F1C';
const COLOR_PRED = '#2C5E1A';

// 예측 모델이 있는 품목만 보여준다 (백엔드 PredictionService.ITEM_TABLE 과 맞출 것)
// agri_price 에는 당근·양배추 가격도 있지만 예측 모델을 채택하지 않았다
const ITEM_ORDER = ['배추', '양파', '홍고추'];

// 품목별 거래 단위
const ITEM_UNIT = {
  배추:   '10키로망대',
  양파:   '1키로',
  홍고추: '10키로상자',
};

// "202606상순" → "2026-06-01" (집계용 날짜)
function periodCodeToDate(code) {
  if (!code || code.length < 7) return null;
  try {
    const year  = parseInt(code.substring(0, 4), 10);
    const month = parseInt(code.substring(4, 6), 10);
    const suffix = code.substring(6);
    const day = suffix === '상순' ? 1 : suffix === '중순' ? 11 : 21;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } catch { return null; }
}

// "202606상순" → "2026-06-상순" (일별 차트 표시용)
function periodCodeToDisplay(code) {
  if (!code || code.length < 7) return null;
  const year   = code.substring(0, 4);
  const month  = code.substring(4, 6);
  const suffix = code.substring(6);
  if (!['상순', '중순', '하순'].includes(suffix)) return null;
  return `${year}-${month}-${suffix}`;
}

function aggregateWeekly(data) {
  const map = new Map();
  data.forEach(({ date, price, predictedPrice, predictionLabel }) => {
    if (!date) return;
    const d = new Date(date);
    if (isNaN(d.getTime())) return;
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const key = toLocalDate(monday);
    if (!map.has(key)) map.set(key, { prices: [], predicted: [], predictionLabels: [] });
    if (price != null) map.get(key).prices.push(price);
    if (predictedPrice != null) {
      map.get(key).predicted.push(predictedPrice);
      if (predictionLabel) map.get(key).predictionLabels.push(predictionLabel);
    }
  });
  return [...map.entries()].map(([date, { prices, predicted, predictionLabels }]) => ({
    date,
    price: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
    predictedPrice: predicted.length > 0 ? Math.round(predicted.reduce((a, b) => a + b, 0) / predicted.length) : null,
    predictionLabel: predictionLabels.length > 0 ? [...new Set(predictionLabels)].join(', ') : null,
  }));
}

function aggregateMonthly(data) {
  const map = new Map();
  data.forEach(({ date, price, predictedPrice, predictionLabel }) => {
    if (!date) return;
    const key = date.substring(0, 7);
    if (!map.has(key)) map.set(key, { prices: [], predicted: [], predictionLabels: [] });
    if (price != null) map.get(key).prices.push(price);
    if (predictedPrice != null) {
      map.get(key).predicted.push(predictedPrice);
      if (predictionLabel) map.get(key).predictionLabels.push(predictionLabel);
    }
  });
  return [...map.entries()].map(([date, { prices, predicted, predictionLabels }]) => ({
    date,
    price: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
    predictedPrice: predicted.length > 0 ? Math.round(predicted.reduce((a, b) => a + b, 0) / predicted.length) : null,
    // 툴팁에 '2026-09' 대신 예측한 순(2026-09-하순)을 보여준다
    predictionLabel: predictionLabels.length > 0 ? [...new Set(predictionLabels)].join(', ') : null,
  }));
}

function formatXTick(dateStr, unit) {
  if (!dateStr) return '';
  if (unit === 'monthly') return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    // 예측 기간 표시: "2026-06-상순" → "06/상순"
    if (/상순|중순|하순/.test(parts[2])) return `${parts[1]}/${parts[2]}`;
    return `${parts[1]}/${parts[2]}`;
  }
  return dateStr;
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const priceEntry = payload.find((p) => p.dataKey === 'price');
  const predEntry  = payload.find((p) => p.dataKey === 'predictedPrice');
  const isActualBridge = payload[0]?.payload?.isActualBridge;
  // 실거래가가 있는 칸(예: 9월 전체)은 그 기간 이름을, 예측만 있는 칸은 예측한 순을 제목으로
  const point = payload[0]?.payload ?? {};
  const hasActual = point.price != null;
  const displayLabel = hasActual ? label : point.predictionLabel ?? label;
  return (
    <div className="rounded-lg border border-border-light bg-white px-3 py-2 text-[13px] shadow">
      <p className="mb-1 font-semibold text-text-main">{displayLabel}</p>
      {priceEntry?.value != null && (
        <p style={{ color: COLOR_ACTUAL }}>
          경매가: {priceEntry.value?.toLocaleString()}원{unit ? ` / ${unit}` : ''}
        </p>
      )}
      {!isActualBridge && predEntry?.value != null && (
        <p className="font-semibold" style={{ color: COLOR_PRED }}>
          AI 예측가{hasActual && point.predictionLabel ? ` (${point.predictionLabel})` : ''}: {predEntry.value?.toLocaleString()}원{unit ? ` / ${unit}` : ''}
        </p>
      )}
    </div>
  );
}

// 시세 머리 — 증권 앱처럼 최근 경매가와 전일 대비를 크게, 기간 최고·최저는 옆에
function PriceSummary({ kpi, unit, loading }) {
  const tone =
    !kpi || kpi.change == null || kpi.change === 0 ? 'text-subtext-light' : kpi.change > 0 ? 'text-price-up' : 'text-price-down';
  const value = (v, big) =>
    loading ? (
      <span className={`inline-block animate-pulse rounded bg-background-light align-middle ${big ? 'h-8 w-36' : 'h-6 w-24'}`} />
    ) : kpi ? (
      `${v.toLocaleString()}원`
    ) : (
      '-'
    );
  return (
    <section className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-line pb-6" aria-busy={loading}>
      <div>
        <p className="text-[13px] text-subtext-light">최근 경매가 · 상 등급</p>
        <p className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[32px] font-bold leading-none tracking-[-0.02em] text-text-main">{value(kpi?.current, true)}</span>
          <span className="text-sm text-subtext-light">/ {unit}</span>
        </p>
        {!loading && kpi && kpi.change !== null && (
          <p className={`mt-2 text-[15px] font-semibold ${tone}`}>
            전일 대비 {kpi.change > 0 ? '+' : kpi.change < 0 ? '−' : ''}
            {Math.abs(kpi.change).toLocaleString()}원{kpi.pct !== null && ` (${kpi.pct > 0 ? '+' : ''}${kpi.pct}%)`}
          </p>
        )}
      </div>
      <dl className="flex gap-10">
        <div>
          <dt className="text-[13px] text-subtext-light">기간 최고</dt>
          <dd className="mt-1 text-lg font-bold text-text-main">{value(kpi?.max)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-subtext-light">기간 최저</dt>
          <dd className="mt-1 text-lg font-bold text-text-main">{value(kpi?.min)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function Detail() {
  // items: agri_price의 품목명 문자열 배열 ['배추', '양파', ...]
  const [items, setItems] = useState([]);
  const [searchParams] = useSearchParams();
  const [wantedItem] = useState(() => searchParams.get('item')); // 처음 들어온 주소의 품목만 본다
  const [selectedItemName, setSelectedItemName] = useState(null);
  const [period, setPeriod] = useState('1month');
  const [unit, setUnit] = useState('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [predictionData, setPredictionData] = useState([]);
  // 지금 화면 데이터를 받아 온 기간 { start, end } ('YYYY-MM-DD')
  const [range, setRange] = useState(null);
  // 작업대 지표 목록 — 이 품목의 '예측은 얼마나 맞았나' 템플릿 링크용(가락 이름 → 작업대 품목 묶음)
  const [catalog, setCatalog] = useState([]);
  useEffect(() => {
    api.getSeriesCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  // ITEM_ORDER 기준으로 정렬
  const sortedItems = useMemo(() => {
    return ITEM_ORDER.filter((n) => items.includes(n));
  }, [items]);

  // 필터를 연달아 바꾸면 응답 순서가 뒤바뀔 수 있어 마지막 요청 결과만 반영한다
  const latestRequest = useRef(0);

  const fetchPriceData = useCallback((itemName, currentPeriod, start, end) => {
    if (!itemName) return;
    if (currentPeriod === 'custom' && (!start || !end)) return;

    const today = new Date();
    let startDate;
    let endDate = today;

    if (currentPeriod === '1month') {
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (currentPeriod === '1year') {
      startDate = new Date(today);
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else if (currentPeriod === 'all') {
      startDate = new Date('2018-01-01');
    } else if (currentPeriod === 'custom') {
      // 'YYYY-MM-DD' 를 new Date() 로 읽으면 UTC 자정이라, 한국 시간 자정으로 직접 만든다
      const [sy, sm, sd] = start.split('-').map(Number);
      const [ey, em, ed] = end.split('-').map(Number);
      startDate = new Date(sy, sm - 1, sd);
      endDate = new Date(ey, em - 1, ed);
    }

    const requestId = ++latestRequest.current;
    setLoading(true);
    api.getAgriPriceGraph(itemName, startDate, endDate)
      .then((data) => {
        if (requestId !== latestRequest.current) return;
        setPriceData(data);
        setRange({ start: toLocalDate(startDate), end: toLocalDate(endDate) });
      })
      .catch((err) => console.error('가격 데이터 로드 실패:', err))
      .finally(() => { if (requestId === latestRequest.current) setLoading(false); });
  }, []);

  // 초기 품목 목록 로드 (agri_price 기반) → 첫 번째 품목 선택
  useEffect(() => {
    api.getAgriItems()
      .then((data) => {
        setItems(data);
        // 홈 오늘의 시장 칸에서 ?item= 으로 들어오면 그 품목부터
        const first = data.includes(wantedItem) && ITEM_ORDER.includes(wantedItem) ? wantedItem : ITEM_ORDER.find((n) => data.includes(n));
        if (first) setSelectedItemName(first);
      })
      .catch((err) => console.error('품목 로드 실패:', err));
  }, [wantedItem]);

  // 직접 지정은 시작일·종료일이 모두 있고 순서가 맞을 때만 조회한다
  const customInvalid = period === 'custom' && customStart && customEnd && customStart > customEnd;

  // 품목·기간이 바뀌면 바로 다시 조회한다 (단위는 받은 데이터를 화면에서 다시 묶기만 한다)
  useEffect(() => {
    if (!selectedItemName || customInvalid) return;
    fetchPriceData(selectedItemName, period, customStart, customEnd);
  }, [selectedItemName, period, customStart, customEnd, customInvalid, fetchPriceData]);

  // 품목 변경 시 예측 데이터 조회
  useEffect(() => {
    if (!selectedItemName) return;
    let cancelled = false;
    api.getPredictions(selectedItemName)
      .then((data) => { if (!cancelled) setPredictionData(data.predictions ?? []); })
      .catch(() => { if (!cancelled) setPredictionData([]); });
    return () => { cancelled = true; };
  }, [selectedItemName]);

  const validPrices = useMemo(() => {
    if (!priceData?.priceData) return [];
    return priceData.priceData.filter((d) => d.price !== null && d.price > 0);
  }, [priceData]);

  const kpi = useMemo(() => {
    if (validPrices.length === 0) return null;
    const last = validPrices[validPrices.length - 1];
    const prev = validPrices.length >= 2 ? validPrices[validPrices.length - 2] : null;
    const allPrices = validPrices.map((d) => d.price);
    const change = prev ? last.price - prev.price : null;
    const pct = prev ? ((change / prev.price) * 100).toFixed(1) : null;
    return {
      current: last.price,
      change,
      pct: pct === null ? null : parseFloat(pct),
      max: Math.max(...allPrices),
      min: Math.min(...allPrices),
    };
  }, [validPrices]);

  // 다음 순 예측은 조회 기간에 오늘이 들어 있을 때만 그린다.
  // 예전 기간(예: 2020년)이나 미래 기간을 보면 가격 없이 예측점 하나만 떠 있었다
  const showPrediction = useMemo(() => {
    if (!range || predictionData.length === 0) return false;
    const today = toLocalDate(new Date());
    return range.start <= today && today <= range.end;
  }, [range, predictionData.length]);

  const chartData = useMemo(() => {
    if (validPrices.length === 0) return [];

    const _t = new Date();
    const todayStr = toLocalDate(_t);
    const _tm = new Date(_t); _tm.setDate(_t.getDate() + 1);
    const tomorrowStr = toLocalDate(_tm);

    const validPred = showPrediction
      ? predictionData.filter((p) => p.predictedPrice != null && p.predictedPrice !== 0)
      : [];
    const latestPred = validPred[0];

    // 실제 날짜 축에 예측점을 배치하고, 화면에는 순별 라벨을 표시한다.
    const predEntries = latestPred ? [latestPred]
      .map((p) => {
        const predictedPrice = Math.round(Number(p.predictedPrice));
        if (!Number.isFinite(predictedPrice)) return null;
        if (unit === 'daily') {
          const date = periodCodeToDate(p.date) ?? p.date;
          if (!date) return null;
          return [date <= todayStr ? todayStr : date, { price: predictedPrice, label: periodCodeToDisplay(p.date) }];
        }
        const date = periodCodeToDate(p.date) ?? p.date;
        if (!date) return null;
        const label = periodCodeToDisplay(p.date);
        return [date <= todayStr ? tomorrowStr : date, { price: predictedPrice, label }];
      })
      .filter(Boolean) : [];
    const predMap = new Map(predEntries);

    const priceMap = new Map(validPrices.map((d) => [d.date, d.price]));
    const allDates = [...new Set([...priceMap.keys(), ...predMap.keys()])].sort();

    const merged = allDates.map((date) => ({
      date,
      price: priceMap.has(date) ? priceMap.get(date) : null,
      predictedPrice: predMap.has(date) ? predMap.get(date).price : null,
      predictionLabel: predMap.has(date) ? predMap.get(date).label : null,
    }));

    // 집계 수행
    let result;
    if (unit === 'weekly')       result = aggregateWeekly(merged);
    else if (unit === 'monthly') result = aggregateMonthly(merged);
    else                         result = merged;

    // 집계 후 브리지: 마지막 실거래가 점의 predictedPrice가 없는 경우에만 연결선 추가
    // isActualBridge 플래그 → 툴팁·dot에서 "AI 예측가" 숨김
    if (validPred.length > 0) {
      let lastActualIdx = -1;
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].price != null) { lastActualIdx = i; break; }
      }
      if (lastActualIdx >= 0 && result[lastActualIdx].predictedPrice == null) {
        result[lastActualIdx] = {
          ...result[lastActualIdx],
          predictedPrice: result[lastActualIdx].price,
          isActualBridge: true,
        };
      }
    }

    return result;
  }, [validPrices, predictionData, unit, showPrediction]);

  const tableData = useMemo(() => {
    const daily = [...validPrices].reverse();
    if (!tableSearch) return daily;
    return daily.filter((d) => d.date.includes(tableSearch));
  }, [validPrices, tableSearch]);

  const periodLabel = useMemo(() => {
    if (period === 'custom' && customStart && customEnd && customStart <= customEnd) return `${customStart} ~ ${customEnd}`;
    if (validPrices.length === 0) return '-';
    return `${validPrices[0].date} ~ ${validPrices[validPrices.length - 1].date}`;
  }, [period, customStart, customEnd, validPrices]);

  const selectedItem = selectedItemName;
  const forecastItem = catalog.find((c) => c.id === `forecast_w:${selectedItem}`)?.item;
  const currentUnit = ITEM_UNIT[selectedItemName] ?? 'kg';

  // 눈금을 8개 안팎으로. 주별·월별처럼 점이 적으면 모두 보여준다
  const xAxisInterval = useMemo(() => Math.max(0, Math.ceil(chartData.length / 8) - 1), [chartData.length]);

  // 기간·단위 고르기 — 회색 바탕에 고른 칸만 흰색
  const segment = (active, onClick, label) => (
    <button
      type="button"
      aria-pressed={active}
      className={`h-8 rounded-md px-3 text-sm font-semibold transition-colors ${
        active ? 'bg-white text-text-main ring-1 ring-border-light' : 'text-subtext-light hover:text-text-main'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
  const periodBtn = (p, label) => segment(period === p, () => setPeriod(p), label);
  const unitBtn = (u, label) => segment(unit === u, () => setUnit(u), label);

  return (
    <Layout>
      <main className="w-full px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <div className="space-y-8">
          {/* 페이지 헤딩 */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold leading-tight tracking-[-0.02em] text-text-main">
                도매가 예측{selectedItem ? ` · ${selectedItem}` : ''}
              </h1>
              <p className="mt-1 text-[15px] text-subtext-light">
                가락시장 경매가 추이와 다음 순 AI 예측, 그리고 지난 예측이 얼마나 맞았는지 봐요.
              </p>
              <p className="text-[13px] text-subtext-light">
                가격 기준: 서울 가락시장 도매 경매가 · 상 등급 · 출처 농넷(서울시농수산식품공사). AI 예측도 같은 기준입니다.
              </p>
            </div>
            {forecastItem && (
              <Link
                to={`/analysis?tpl=forecast&item=${encodeURIComponent(forecastItem)}`}
                className="inline-flex h-9 items-center rounded-lg bg-background-light px-3.5 text-sm font-semibold text-text-main hover:bg-border-light"
              >
                작업대에서 예측과 실제 겹쳐 보기
              </Link>
            )}
          </div>

          {/* 필터 & 컨트롤 패널 */}
          <div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">

              {/* 품종 선택 */}
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-subtext-light" htmlFor="item-select">
                  품목
                </label>
                <select
                  id="item-select"
                  className="h-10 min-w-[160px] rounded-lg border border-border-light bg-white px-3 text-[15px] text-text-main focus:border-primary"
                  value={selectedItemName ?? ''}
                  onChange={(e) => setSelectedItemName(e.target.value)}
                >
                  {sortedItems.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* 기간 설정 */}
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-medium text-subtext-light">기간</p>
                <div className="inline-flex flex-wrap rounded-lg bg-background-light p-1">
                  {periodBtn('1month', '최근 1개월')}
                  {periodBtn('1year', '1년')}
                  {periodBtn('all', '전체')}
                  {periodBtn('custom', '직접 지정')}
                </div>
              </div>

              {/* 단위 */}
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-medium text-subtext-light">단위</p>
                <div className="inline-flex rounded-lg bg-background-light p-1">
                  {unitBtn('daily', '일별')}
                  {unitBtn('weekly', '주별')}
                  {unitBtn('monthly', '월별')}
                </div>
              </div>
            </div>

            {/* 날짜 직접 지정 */}
            {period === 'custom' && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="date"
                  className="h-10 rounded-lg border border-border-light bg-white px-3 text-sm text-text-main focus:border-primary"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-subtext-light font-medium">~</span>
                <input
                  type="date"
                  className="h-10 rounded-lg border border-border-light bg-white px-3 text-sm text-text-main focus:border-primary"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
                <p className={`text-sm ${customInvalid ? 'text-red-700' : 'text-subtext-light'}`}>
                  {customInvalid
                    ? '시작일이 종료일보다 늦어요.'
                    : customStart && customEnd ? '' : '시작일과 종료일을 고르면 바로 조회해요.'}
                </p>
              </div>
            )}
          </div>

          {/* 시세 머리 */}
          <PriceSummary kpi={kpi} unit={currentUnit} loading={loading} />

          {/* 가격 추이 차트 */}
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-[-0.02em] text-text-main">{selectedItem ?? '품목'} 가격 추이</h2>
                <p className="mt-0.5 text-[13px] text-subtext-light">기간 {periodLabel} · 서울 가락시장 경매가(상 등급)</p>
              </div>
              <div className="flex items-center gap-4 text-[13px] text-subtext-light">
                <span className="flex items-center gap-2">
                  <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke={COLOR_ACTUAL} strokeWidth="2" /></svg>
                  경매가
                </span>
                {showPrediction && (
                  <span className="flex items-center gap-2">
                    <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke={COLOR_PRED} strokeWidth="2" strokeDasharray="4 3" /></svg>
                    AI 예측가
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex h-[300px] items-center justify-center gap-2.5 text-sm text-subtext-light" role="status">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-light border-t-primary" aria-hidden="true" />
                불러오는 중이에요
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-[300px] flex-col items-center justify-center rounded-xl bg-background-light text-center">
                <p className="text-[15px] font-semibold text-text-main">이 기간에는 데이터가 없어요</p>
                <p className="mt-1 text-sm text-subtext-light">다른 품목이나 기간을 골라 보세요.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid stroke="#EDF0ED" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d, index) => (chartData[index]?.price == null && chartData[index]?.predictionLabel) || formatXTick(d, unit)}
                    tick={{ fontSize: 12, fill: '#5D6560' }}
                    interval={xAxisInterval}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v.toLocaleString()}`}
                    tick={{ fontSize: 12, fill: '#5D6560' }}
                    width={75}
                  />
                  <Tooltip content={<CustomTooltip unit={currentUnit} />} />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={COLOR_ACTUAL}
                    strokeWidth={2}
                    dot={chartData.length <= 60 ? { r: 3, fill: COLOR_ACTUAL } : false}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                  {showPrediction && (
                    <Line
                      type="monotone"
                      dataKey="predictedPrice"
                      stroke={COLOR_PRED}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={chartData.length <= 60
                        ? (p) => {
                            if (p.value == null || p.payload?.isActualBridge) return null;
                            return <circle key={p.key} cx={p.cx} cy={p.cy} r={3} fill={COLOR_PRED} />;
                          }
                        : false}
                      activeDot={(p) => p.value == null || p.payload?.isActualBridge
                        ? null
                        : <circle key={p.key} cx={p.cx} cy={p.cy} r={5} fill={COLOR_PRED} />}
                      connectNulls={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* 예측 적중 이력 */}
          {selectedItem && <PredictionHistory itemName={selectedItem} unit={currentUnit} />}

          {/* 상세 데이터 테이블 */}
          <section className="border-t border-line pt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-bold tracking-[-0.02em] text-text-main">상세 데이터</h2>
              <div className="relative w-full md:w-64">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-subtext-light" aria-hidden="true">search</span>
                <input
                  aria-label="날짜 검색"
                  className="h-10 w-full rounded-lg border border-border-light bg-white pl-10 pr-4 text-sm text-text-main focus:border-primary"
                  placeholder="날짜 검색 (예: 2024-01)"
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-border-light text-[13px] text-subtext-light">
                  <tr>
                    <th className="py-2.5 pr-4 font-medium" scope="col">날짜</th>
                    <th className="py-2.5 pr-4 text-right font-medium" scope="col">경매가 (원 / {currentUnit})</th>
                    <th className="py-2.5 pr-4 font-medium" scope="col">등급</th>
                    <th className="py-2.5 text-right font-medium" scope="col">전일 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-subtext-light">
                        {loading ? '불러오는 중이에요' : '데이터가 없어요'}
                      </td>
                    </tr>
                  ) : (
                    tableData.slice(0, 20).map((row, i, arr) => {
                      const prevRow = arr[i + 1];
                      const change = prevRow ? row.price - prevRow.price : 0;
                      const pct = prevRow ? ((change / prevRow.price) * 100).toFixed(1) : null;
                      const isLast = i === Math.min(tableData.length, 20) - 1;
                      return (
                        <tr key={row.date} className={!isLast ? 'border-b border-line' : ''}>
                          <td className="whitespace-nowrap py-3 pr-4 text-text-main">{row.date}</td>
                          <td className="py-3 pr-4 text-right font-semibold tabular-nums text-text-main">{row.price?.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-subtext-light">{row.grade ?? '-'}</td>
                          <td
                            className={`py-3 text-right tabular-nums ${
                              pct === null
                                ? 'text-subtext-light '
                                : parseFloat(pct) > 0
                                ? 'text-price-up'
                                : parseFloat(pct) < 0
                                ? 'text-price-down'
                                : 'text-subtext-light '
                            }`}
                          >
                            {pct === null ? '-' : `${parseFloat(pct) > 0 ? '+' : parseFloat(pct) < 0 ? '−' : ''}${Math.abs(parseFloat(pct)).toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {tableData.length > 20 && (
                <p className="mt-3 text-center text-xs text-subtext-light">
                  최근 20건 (전체 {tableData.length}건)
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
