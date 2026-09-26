import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api/api';

// 상세 가격 차트와 같은 색: 실제 = 파랑, 예측 = 주황 (검증은 점선, 운영 예측은 굵은 점)
const COLOR_ACTUAL = '#4A90E2';
const COLOR_PRED = '#F59E0B';
const RANK = { 상순: 1, 중순: 2, 하순: 3 };

// "202603중순" → 정렬 키 / "3월 중순"
const rankOf = (code) => Number(code.slice(0, 6)) * 10 + (RANK[code.slice(6)] ?? 0);
const labelOf = (code) => `${Number(code.slice(4, 6))}월 ${code.slice(6)}`;
const won = (v) => (v == null ? '-' : `${Math.round(v).toLocaleString()}원`);

function HistoryTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="p-3 bg-white border border-border-light rounded-lg shadow-lg text-sm">
      <p className="font-semibold text-text-main mb-1">{d.label}</p>
      <p className="text-text-main"><span style={{ color: COLOR_ACTUAL }}>●</span> 실제 {won(d.actual)} / {unit}</p>
      {d.backtest != null && <p className="text-text-main"><span style={{ color: COLOR_PRED }}>●</span> 검증 예측 {won(d.backtest)}</p>}
      {d.live != null && <p className="text-text-main"><span style={{ color: COLOR_PRED }}>◆</span> 운영 예측 {won(d.live)}</p>}
      {d.errorPct != null && <p className="text-subtext-light mt-1">오차 {d.errorPct.toFixed(1)}%</p>}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-background-light px-4 py-3">
      <p className="text-xs text-subtext-light">{label}</p>
      <p className="text-2xl font-bold text-text-main mt-0.5">{value}</p>
      {sub && <p className="text-xs text-subtext-light mt-0.5">{sub}</p>}
    </div>
  );
}

// 예측 적중 이력: 2026년 각 순을 직전까지의 데이터로만 예측한 검증(백테스트) + 매일 배치가 실제로 낸 예측
export default function PredictionHistory({ itemName, unit }) {
  const [history, setHistory] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!itemName) return;
    let cancelled = false;
    setStatus('loading');
    api.getPredictionHistory(itemName)
      .then((data) => { if (!cancelled) { setHistory(data); setStatus('ready'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [itemName]);

  const rows = useMemo(() => {
    if (!history) return [];
    const map = new Map();
    const put = (r, key) => {
      const cur = map.get(r.date) ?? { date: r.date, label: labelOf(r.date), actual: r.actualPrice };
      cur[key] = r.predictedPrice;
      // 운영 예측이 있으면 그 오차를, 없으면 검증 오차를 보여준다
      if (key === 'live' || cur.errorPct == null) cur.errorPct = Math.abs(r.predictedPrice - r.actualPrice) / r.actualPrice * 100;
      map.set(r.date, cur);
    };
    history.backtest.forEach((r) => put(r, 'backtest'));
    history.live.forEach((r) => put(r, 'live'));
    return [...map.values()].sort((a, b) => rankOf(a.date) - rankOf(b.date));
  }, [history]);

  const summary = history?.summary;
  const hasLive = rows.some((r) => r.live != null);

  return (
    <div className="p-6 bg-surface-light rounded-xl border border-border-light shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-text-main">{itemName} 예측 적중 이력</h3>
        <p className="text-sm text-subtext-light">
          2026년 각 순을 그 직전까지의 데이터로만 학습해 예측하고, 실제 순 평균 가격과 비교했습니다.
        </p>
      </div>

      {status === 'loading' ? (
        <div className="h-48 rounded-lg bg-background-light animate-pulse" />
      ) : status === 'error' ? (
        <p className="py-10 text-center text-sm text-red-600">적중 이력을 불러오지 못했습니다.</p>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-subtext-light">
          <span className="material-symbols-outlined text-4xl block mb-2">history</span>
          아직 비교할 수 있는 예측 기록이 없습니다.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <Stat
              label="평균 오차율 (검증)"
              value={summary.backtestMape != null ? `${summary.backtestMape}%` : '-'}
              sub={`2026년 ${summary.backtestCount}개 순`}
            />
            <Stat
              label="평균 오차율 (실제 운영 예측)"
              value={summary.liveMape != null ? `${summary.liveMape}%` : '-'}
              sub={summary.liveCount ? `${summary.liveCount}개 순 확정` : '실제 가격이 확정되면 쌓입니다'}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-subtext-light mb-2">
            <span className="flex items-center gap-2">
              <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke={COLOR_ACTUAL} strokeWidth="2" /></svg>
              실제 가격
            </span>
            <span className="flex items-center gap-2">
              <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke={COLOR_PRED} strokeWidth="2" strokeDasharray="4 3" /></svg>
              검증 예측
            </span>
            {hasLive && (
              <span className="flex items-center gap-2">
                <svg width="12" height="12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" fill={COLOR_PRED} /></svg>
                운영 예측
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={rows} margin={{ top: 5, right: 16, left: 4, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 11, fill: '#64748B' }} width={70} />
              <Tooltip content={<HistoryTooltip unit={unit} />} cursor={{ stroke: '#94A3B8', strokeDasharray: '3 3' }} />
              <Line type="monotone" dataKey="actual" stroke={COLOR_ACTUAL} strokeWidth={2} dot={{ r: 3, fill: COLOR_ACTUAL }} activeDot={{ r: 5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="backtest" stroke={COLOR_PRED} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: COLOR_PRED }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              {hasLive && (
                <Line
                  dataKey="live"
                  stroke="none"
                  isAnimationActive={false}
                  dot={(p) => (p.value == null ? null : (
                    <rect key={p.key} x={p.cx - 5} y={p.cy - 5} width="10" height="10" transform={`rotate(45 ${p.cx} ${p.cy})`}
                      fill={COLOR_PRED} stroke="#fff" strokeWidth="2" />
                  ))}
                  activeDot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto mt-5">
            <table className="w-full text-sm text-left">
              <caption className="sr-only">{itemName} 순별 예측과 실제 가격</caption>
              <thead className="text-xs text-subtext-light bg-background-light">
                <tr>
                  <th className="px-2 sm:px-4 py-2 rounded-l-lg" scope="col">순</th>
                  <th className="px-2 sm:px-4 py-2" scope="col">예측</th>
                  <th className="px-2 sm:px-4 py-2" scope="col">실제</th>
                  <th className="px-2 sm:px-4 py-2 rounded-r-lg" scope="col">오차율</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().slice(0, 6).map((r) => (
                  <tr key={r.date} className="border-b border-border-light last:border-0">
                    <td className="px-2 sm:px-4 py-2.5 whitespace-nowrap">
                      {r.label}
                      {r.live != null && <span className="ml-2 text-xs text-subtext-light">운영</span>}
                    </td>
                    <td className="px-2 sm:px-4 py-2.5 whitespace-nowrap">{won(r.live ?? r.backtest)}</td>
                    <td className="px-2 sm:px-4 py-2.5 whitespace-nowrap">{won(r.actual)}</td>
                    <td className="px-2 sm:px-4 py-2.5 whitespace-nowrap">{r.errorPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 6 && <p className="text-xs text-subtext-light text-center mt-2">최근 6개 순 (전체 {rows.length}개)</p>}
          </div>
        </>
      )}
    </div>
  );
}
