import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeading from '../components/PageHeading';
import ItemJourney from '../components/ItemJourney';
import Icon from '../components/Icon';
import PredictionHistory from '../components/PredictionHistory';
import { api } from '../api/api';
import { toLocalDate } from '../date';

// 실제 = 진한 회색 실선, AI 예측 = 브랜드 초록 점선 (PredictionHistory 와 같은 색)
const COLOR_ACTUAL = '#182D26';
const COLOR_PRED = '#174F3C';

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
    <section className="flex flex-col items-start justify-center gap-5 panel h-full" aria-busy={loading}>
      <div>
        <p className="text-[13px] text-subtext-light">조회 기간 마지막 경매가 · 상 등급</p>
        <p className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[38px] font-semibold leading-none tracking-[-0.02em] text-text-main">{value(kpi?.current, true)}</span>
          <span className="text-sm text-subtext-light">/ {unit}</span>
        </p>
        {!loading && kpi?.date && <p className="mt-2 text-xs text-subtext-light">{kpi.date} 기준</p>}
        {!loading && kpi && kpi.change !== null && (
          <p className={`mt-2 text-[15px] font-semibold ${tone}`}>
            전일 대비 {kpi.change > 0 ? '+' : kpi.change < 0 ? '−' : ''}
            {Math.abs(kpi.change).toLocaleString()}원{kpi.pct !== null && ` (${kpi.pct > 0 ? '+' : ''}${kpi.pct}%)`}
          </p>
        )}
      </div>
      <dl className="flex w-full gap-8 border-t border-line pt-4">
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
  const [searchParams, setSearchParams] = useSearchParams();
  const wantedItem = searchParams.get('item');
  const [selectedItemName, setSelectedItemName] = useState(null);
  const [period, setPeriod] = useState('1month');
  const [unit, setUnit] = useState('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [predictionData, setPredictionData] = useState([]);
  const [predictionStatus, setPredictionStatus] = useState('loading');
  const [priceError, setPriceError] = useState(false);
  const [itemsAttempt, setItemsAttempt] = useState(0);
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
    setPriceError(false);
    api.getAgriPriceGraph(itemName, startDate, endDate)
      .then((data) => {
        if (requestId !== latestRequest.current) return;
        setPriceData(data);
        setRange({ start: toLocalDate(startDate), end: toLocalDate(endDate) });
      })
      .catch(() => { if (requestId === latestRequest.current) { setPriceError(true); setPriceData(null); setRange(null); } })
      .finally(() => { if (requestId === latestRequest.current) setLoading(false); });
  }, []);

  // 목록은 처음과 재시도 때만 조회하고 URL의 품목은 별도로 동기화한다.
  useEffect(() => {
    let cancelled = false;
    setPriceError(false);
    api.getAgriItems()
      .then((data) => { if (!cancelled) setItems(data); })
      .catch(() => { if (!cancelled) setPriceError(true); });
    return () => { cancelled = true; };
  }, [itemsAttempt]);

  useEffect(() => {
    const next = sortedItems.includes(wantedItem) ? wantedItem : sortedItems[0];
    if (next) setSelectedItemName(next);
  }, [wantedItem, sortedItems]);

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
    setPredictionData([]);
    setPredictionStatus('loading');
    api.getPredictions(selectedItemName)
      .then((data) => { if (!cancelled) { setPredictionData(data.predictions ?? []); setPredictionStatus('ready'); } })
      .catch(() => { if (!cancelled) { setPredictionData([]); setPredictionStatus('error'); } });
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
      date: last.date,
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

  const latestForecast = predictionData.find((p) => Number.isFinite(Number(p.predictedPrice)) && Number(p.predictedPrice) > 0);

  return (
    <Layout>
      <main className="page-shell">
        <div className="space-y-8">
          <PageHeading title="도매 시세와 전망" description="가락시장의 가격 흐름과 AI 예측을 함께 확인하세요.">
            {forecastItem && <Link to={`/analysis?tpl=forecast&item=${encodeURIComponent(forecastItem)}`} className="button-secondary">예측과 실제 비교<Icon className="size-4" /></Link>}
          </PageHeading>
          <div className="crop-tabs" role="group" aria-label="도매 품목">
            {sortedItems.map((name) => <button type="button" key={name} aria-pressed={selectedItemName === name} onClick={() => { setSelectedItemName(name); setSearchParams({ item: name }); }} className={`crop-tab ${selectedItemName === name ? 'crop-tab-active' : ''}`}>{name}</button>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <PriceSummary kpi={kpi} unit={currentUnit} loading={loading} />
            <section className="rounded-2xl border border-primary/10 bg-primary-light p-6">
              <span className="pill !border-primary/15 !bg-white/60 !text-primary">AI 순 평균 예측</span>
              {predictionStatus === 'loading' ? <p className="mt-5 text-sm text-subtext-light" role="status">예측을 불러오고 있어요</p> : latestForecast ? <>
                <h2 className="mt-4 text-[15px] font-medium text-primary">{selectedItem} · {periodCodeToDisplay(latestForecast.date)?.replaceAll('-', ' ') ?? latestForecast.date}</h2>
                <p className="mt-1 text-[38px] font-semibold tracking-[-0.04em] tabular-nums text-forest">{Math.round(Number(latestForecast.predictedPrice)).toLocaleString()}<span className="ml-1 text-base">원</span></p>
                <p className="mt-1 text-sm text-subtext-light">/ {currentUnit} · 상 등급</p>
              </> : <p className="mt-5 text-sm text-subtext-light" role={predictionStatus === 'error' ? 'alert' : 'status'}>{predictionStatus === 'error' ? '예측을 불러오지 못했어요.' : '아직 공개된 예측이 없어요.'}</p>}
              <p className="mt-4 text-xs leading-relaxed text-subtext-light">상순 1~10일 · 중순 11~20일 · 하순 21일~말일.<br />표시된 구간의 평균 가격을 예측하며 실제 가격과 다를 수 있어요.</p>
            </section>
          </div>
          <p className="data-note">서울 가락시장 경매가 · 상 등급 · 농넷(서울시농수산식품공사). 실제 가격과 AI 예측 모두 같은 기준입니다.</p>
          <ItemJourney item={selectedItem} current="wholesale" />
          <div className="panel space-y-7">
          {/* 필터 & 컨트롤 패널 */}
          <div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">

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
                  aria-label="조회 시작일"
                  className="h-10 rounded-lg border border-border-light bg-white px-3 text-sm text-text-main focus:border-primary"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-subtext-light font-medium">~</span>
                <input
                  type="date"
                  aria-label="조회 종료일"
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

            {priceError ? <p role="alert" className="py-12 text-center text-sm text-red-700">가격을 불러오지 못했어요. <button className="underline" onClick={() => selectedItemName ? fetchPriceData(selectedItemName, period, customStart, customEnd) : setItemsAttempt((n) => n + 1)}>다시 시도</button></p> : loading ? (
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
                  <CartesianGrid stroke="#EAF0EB" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => {
                      const point = chartData.find((row) => row.date === d);
                      return formatXTick(unit === 'daily' && point?.price == null && point?.predictionLabel ? point.predictionLabel : d, unit);
                    }}
                    tick={{ fontSize: 12, fill: '#60736A' }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v.toLocaleString()}`}
                    tick={{ fontSize: 12, fill: '#60736A' }}
                    width={60}
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

          </div>

          {/* 예측 적중 이력 */}
          {selectedItem && <PredictionHistory itemName={selectedItem} unit={currentUnit} />}

          {/* 상세 데이터 테이블 */}
          <section className="panel">
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
                            className={`whitespace-nowrap py-3 text-right tabular-nums ${
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
