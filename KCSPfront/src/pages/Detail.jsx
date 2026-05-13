import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Layout from '../components/Layout';
import { api } from '../api/api';

// agri_price 테이블에서 받아온 품목명 순서 고정
const ITEM_ORDER = ['배추', '양파', '양배추', '당근'];

// 품목별 거래 단위
const ITEM_UNIT = {
  배추:   '10키로망대',
  양파:   '1키로',
  양배추: '8키로망대',
  당근:   '20키로상자',
};

function aggregateWeekly(data) {
  const map = new Map();
  data.forEach(({ date, price }) => {
    const d = new Date(date);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const key = monday.toISOString().split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(price);
  });
  return [...map.entries()].map(([date, prices]) => ({
    date,
    price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
  }));
}

function aggregateMonthly(data) {
  const map = new Map();
  data.forEach(({ date, price }) => {
    const key = date.substring(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(price);
  });
  return [...map.entries()].map(([date, prices]) => ({
    date,
    price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
  }));
}

function formatXTick(dateStr, unit) {
  if (!dateStr) return '';
  if (unit === 'monthly') return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return dateStr;
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-3 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg text-sm">
      <p className="font-semibold text-text-light dark:text-text-dark mb-1">{label}</p>
      <p style={{ color: '#4A90E2' }}>
        {payload[0].value?.toLocaleString()}원{unit ? ` / ${unit}` : ''}
      </p>
    </div>
  );
}

function KpiCard({ label, value, sub, valueColor, loading }) {
  return (
    <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
      <p className="text-sm font-medium text-subtext-light dark:text-subtext-dark">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        {loading ? (
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-28" />
        ) : (
          <>
            <p className={`text-3xl font-bold ${valueColor || 'text-text-light dark:text-text-dark'}`}>{value}</p>
            {sub && <span className={`text-sm font-semibold ${valueColor || 'text-subtext-light dark:text-subtext-dark'}`}>{sub}</span>}
          </>
        )}
      </div>
    </div>
  );
}

export default function Detail() {
  // items: agri_price의 품목명 문자열 배열 ['배추', '양파', ...]
  const [items, setItems] = useState([]);
  const [selectedItemName, setSelectedItemName] = useState(null);
  const [period, setPeriod] = useState('1month');
  const [unit, setUnit] = useState('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // ITEM_ORDER 기준으로 정렬
  const sortedItems = useMemo(() => {
    const ordered = ITEM_ORDER.filter((n) => items.includes(n));
    const rest = items.filter((n) => !ITEM_ORDER.includes(n));
    return [...ordered, ...rest];
  }, [items]);

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
      startDate = new Date(start);
      endDate = new Date(end);
    }

    setLoading(true);
    api.getAgriPriceGraph(itemName, startDate, endDate)
      .then((data) => setPriceData(data))
      .catch((err) => console.error('가격 데이터 로드 실패:', err))
      .finally(() => setLoading(false));
  }, []);

  // 초기 품목 목록 로드 (agri_price 기반) → 첫 번째 품목 자동 조회
  useEffect(() => {
    api.getAgriItems()
      .then((data) => {
        setItems(data);
        const ordered = ITEM_ORDER.filter((n) => data.includes(n));
        const first = ordered.length > 0 ? ordered[0] : data[0];
        if (first) {
          setSelectedItemName(first);
          fetchPriceData(first, '1month', '', '');
        }
      })
      .catch((err) => console.error('품목 로드 실패:', err));
  }, [fetchPriceData]);

  // 품목 변경 시 자동 재조회
  useEffect(() => {
    if (selectedItemName) fetchPriceData(selectedItemName, period, customStart, customEnd);
  }, [selectedItemName]);

  const handleSearch = () => {
    fetchPriceData(selectedItemName, period, customStart, customEnd);
  };

  const validPrices = useMemo(() => {
    if (!priceData?.priceData) return [];
    return priceData.priceData.filter((d) => d.price !== null && d.price > 0);
  }, [priceData]);

  const kpi = useMemo(() => {
    if (validPrices.length === 0) return null;
    const last = validPrices[validPrices.length - 1];
    const prev = validPrices.length >= 2 ? validPrices[validPrices.length - 2] : null;
    const allPrices = validPrices.map((d) => d.price);
    const change = prev ? last.price - prev.price : 0;
    const pct = prev ? ((change / prev.price) * 100).toFixed(1) : '0.0';
    return {
      current: last.price,
      change,
      pct: parseFloat(pct),
      max: Math.max(...allPrices),
      min: Math.min(...allPrices),
    };
  }, [validPrices]);

  const chartData = useMemo(() => {
    if (validPrices.length === 0) return [];
    if (unit === 'weekly') return aggregateWeekly(validPrices);
    if (unit === 'monthly') return aggregateMonthly(validPrices);
    return validPrices.map((d) => ({ date: d.date, price: d.price }));
  }, [validPrices, unit]);

  const tableData = useMemo(() => {
    const daily = [...validPrices].reverse();
    if (!tableSearch) return daily;
    return daily.filter((d) => d.date.includes(tableSearch));
  }, [validPrices, tableSearch]);

  const periodLabel = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) return `${customStart} ~ ${customEnd}`;
    if (validPrices.length === 0) return '-';
    return `${validPrices[0].date} ~ ${validPrices[validPrices.length - 1].date}`;
  }, [period, customStart, customEnd, validPrices]);

  const selectedItem = selectedItemName;
  const currentUnit = ITEM_UNIT[selectedItemName] ?? 'kg';

  const xAxisInterval = useMemo(() => {
    if (chartData.length <= 30) return 4;
    if (chartData.length <= 90) return 14;
    if (chartData.length <= 365) return 30;
    return Math.floor(chartData.length / 12);
  }, [chartData.length]);

  const periodBtn = (p, label, icon) => (
    <button
      className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition ${
        period === p
          ? 'bg-primary/20 text-primary'
          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-text-light dark:text-text-dark'
      }`}
      onClick={() => setPeriod(p)}
    >
      {icon && <span className="material-symbols-outlined text-lg">{icon}</span>}
      {label}
    </button>
  );

  const unitBtn = (u, label) => (
    <button
      className={`flex-1 text-center text-sm py-1 rounded-md transition ${
        unit === u
          ? 'bg-surface-light dark:bg-surface-dark shadow-sm font-semibold text-text-light dark:text-text-dark'
          : 'text-subtext-light dark:text-subtext-dark'
      }`}
      onClick={() => setUnit(u)}
    >
      {label}
    </button>
  );

  return (
    <Layout>
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* 페이지 헤딩 */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-3xl font-extrabold tracking-tight text-text-light dark:text-text-dark">
                농산물 가격 분석{selectedItem ? `: ${selectedItem}` : ''}
              </h2>
              <p className="text-base font-normal text-subtext-light dark:text-subtext-dark">
                과거, 현재, 그리고 AI 예측 가격 데이터를 시각적으로 분석하세요.
              </p>
            </div>
          </div>

          {/* 필터 & 컨트롤 패널 */}
          <div className="p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

              {/* 품종 선택 */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-text-light dark:text-text-dark" htmlFor="item-select">
                  품종 선택
                </label>
                <select
                  id="item-select"
                  className="w-full h-10 px-3 text-base bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition"
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
                <p className="text-sm font-semibold text-text-light dark:text-text-dark">기간 설정</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {periodBtn('1month', '최근 1개월')}
                  {periodBtn('1year', '1년')}
                  {periodBtn('all', '전체')}
                  {periodBtn('custom', '지정', 'calendar_month')}
                </div>
              </div>

              {/* 단위 */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-text-light dark:text-text-dark">단위</p>
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  {unitBtn('daily', '일별')}
                  {unitBtn('weekly', '주별')}
                  {unitBtn('monthly', '월별')}
                </div>
              </div>

              {/* 검색 버튼 */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-text-light dark:text-text-dark">조회</p>
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full h-10 px-4 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <span className="material-symbols-outlined text-lg">search</span>
                  검색
                </button>
              </div>
            </div>

            {/* 날짜 직접 지정 */}
            {period === 'custom' && (
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="date"
                  className="h-10 px-3 text-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary transition"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-subtext-light dark:text-subtext-dark font-medium">~</span>
                <input
                  type="date"
                  className="h-10 px-3 text-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary transition"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* KPI 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard
              label="현재 평균 도매가"
              value={kpi ? `${kpi.current.toLocaleString()}원` : '-'}
              sub={`/ ${currentUnit}`}
              loading={loading}
            />
            <KpiCard
              label="전일 대비"
              value={
                kpi
                  ? `${kpi.change > 0 ? '▲' : kpi.change < 0 ? '▼' : '―'} ${Math.abs(kpi.change).toLocaleString()}원`
                  : '-'
              }
              sub={kpi ? `(${kpi.pct > 0 ? '+' : ''}${kpi.pct}%)` : ''}
              valueColor={
                kpi
                  ? kpi.change > 0
                    ? 'text-blue-500'
                    : kpi.change < 0
                    ? 'text-red-500'
                    : 'text-subtext-light dark:text-subtext-dark'
                  : ''
              }
              loading={loading}
            />
            <KpiCard
              label="기간 최고가"
              value={kpi ? `${kpi.max.toLocaleString()}원` : '-'}
              sub={`/ ${currentUnit}`}
              loading={loading}
            />
            <KpiCard
              label="기간 최저가"
              value={kpi ? `${kpi.min.toLocaleString()}원` : '-'}
              sub={`/ ${currentUnit}`}
              loading={loading}
            />
          </div>

          {/* 가격 추이 차트 */}
          <div className="p-6 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-text-light dark:text-text-dark">
                  {selectedItem ?? '품목'} 가격 추이
                </h3>
                <p className="text-sm text-subtext-light dark:text-subtext-dark">기간: {periodLabel}</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#4A90E2' }}></div>
                <span className="text-subtext-light dark:text-subtext-dark">실거래가</span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64 bg-background-light dark:bg-background-dark rounded-lg">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-subtext-light dark:text-subtext-dark">데이터 로딩중...</p>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-background-light dark:bg-background-dark rounded-lg border border-dashed border-border-light dark:border-border-dark">
                <span className="material-symbols-outlined text-5xl text-subtext-light dark:text-subtext-dark mb-3">bar_chart</span>
                <p className="text-lg font-semibold text-subtext-light dark:text-subtext-dark">데이터가 없습니다</p>
                <p className="text-sm text-subtext-light dark:text-subtext-dark mt-1">품목 또는 기간을 선택 후 검색해 주세요</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => formatXTick(d, unit)}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    interval={xAxisInterval}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v.toLocaleString()}`}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    width={75}
                  />
                  <Tooltip content={<CustomTooltip unit={currentUnit} />} />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#4A90E2"
                    strokeWidth={2}
                    dot={chartData.length <= 60 ? { r: 3, fill: '#4A90E2' } : false}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 상세 데이터 테이블 */}
          <div className="p-6 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold text-text-light dark:text-text-dark">상세 데이터</h3>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtext-light dark:text-subtext-dark">search</span>
                <input
                  className="w-full md:w-64 h-10 pl-10 pr-4 text-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition"
                  placeholder="날짜 검색 (예: 2024-01)..."
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-subtext-light dark:text-subtext-dark uppercase bg-background-light dark:bg-background-dark">
                  <tr>
                    <th className="px-6 py-3 rounded-l-lg" scope="col">날짜</th>
                    <th className="px-6 py-3" scope="col">가격 (원 / {currentUnit})</th>
                    <th className="px-6 py-3" scope="col">등급</th>
                    <th className="px-6 py-3 rounded-r-lg" scope="col">등락률</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-subtext-light dark:text-subtext-dark">
                        {loading ? '데이터 로딩중...' : '데이터가 없습니다'}
                      </td>
                    </tr>
                  ) : (
                    tableData.slice(0, 20).map((row, i, arr) => {
                      const prevRow = arr[i + 1];
                      const change = prevRow ? row.price - prevRow.price : 0;
                      const pct = prevRow ? ((change / prevRow.price) * 100).toFixed(1) : null;
                      const isLast = i === Math.min(tableData.length, 20) - 1;
                      return (
                        <tr
                          key={row.date}
                          className={`bg-surface-light dark:bg-surface-dark ${!isLast ? 'border-b dark:border-border-dark' : ''}`}
                        >
                          <td className="px-6 py-4 font-medium whitespace-nowrap">{row.date}</td>
                          <td className="px-6 py-4">{row.price?.toLocaleString()}</td>
                          <td className="px-6 py-4 text-subtext-light dark:text-subtext-dark">{row.grade ?? '-'}</td>
                          <td
                            className={`px-6 py-4 ${
                              pct === null
                                ? 'text-subtext-light dark:text-subtext-dark'
                                : parseFloat(pct) > 0
                                ? 'text-blue-500'
                                : parseFloat(pct) < 0
                                ? 'text-red-500'
                                : 'text-subtext-light dark:text-subtext-dark'
                            }`}
                          >
                            {pct === null ? '-' : `${parseFloat(pct) > 0 ? '+' : ''}${pct}%`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {tableData.length > 20 && (
                <p className="text-xs text-subtext-light dark:text-subtext-dark text-center mt-3">
                  상위 20건 표시 중 (전체 {tableData.length}건)
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
