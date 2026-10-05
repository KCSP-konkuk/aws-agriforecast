import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/api';
import { align, allowedFreqs, displayUnit, prepare, rangeOf, readState } from '../lib/series';
import { AXIS, CHARTS, colorOf, keyLabel, num } from './workbench/format';

function PreviewTip({ active, payload, lines, f }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow px-3 py-2 text-xs">
      <p className="font-semibold text-text-main mb-1">{keyLabel(row.key, f)}</p>
      {lines.map(
        (l) =>
          row[l.id] != null && (
            <p key={l.id} className="text-text-main">
              <span style={{ color: colorOf(l.color) }}>●</span> {l.name} <b>{num(row[l.id])}</b>
            </p>
          ),
      )}
    </div>
  );
}

// 커뮤니티 글에 붙인 작업대 화면 미리보기 — 고른 지표를 저장된 주기 · 변환 · 시차 · 기간으로 작게 그리고,
// [작업대에서 열기]로 그 화면(차트 · 조건까지)을 그대로 연다. 단위가 여러 개면 미리보기만 지수로 한 판에
export default function AnalysisPreview({ query }) {
  const state = useMemo(() => readState(new URLSearchParams(query)), [query]);
  const [catalog, setCatalog] = useState(null);
  const [points, setPoints] = useState(null);

  useEffect(() => {
    api
      .getSeriesCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    const ids = state.series.map((s) => s.id);
    if (!ids.length) return undefined;
    let alive = true;
    api
      .getSeriesData(ids)
      .then((res) => alive && setPoints(Object.fromEntries((res.series ?? []).map((s) => [s.id, s.points]))))
      .catch(() => alive && setPoints({}));
    return () => {
      alive = false;
    };
  }, [state]);

  const view = useMemo(() => {
    if (!catalog || !points) return null;
    const byId = Object.fromEntries(catalog.map((c) => [c.id, c]));
    const series = state.series.filter((s) => byId[s.id] && points[s.id]?.length);
    if (!series.length) return { lines: [], rows: [] };
    const allowed = allowedFreqs(series.map((s) => byId[s.id]));
    const f = allowed.includes(state.freq) ? state.freq : allowed[0];
    const last = series
      .map((s) => byId[s.id].lastDate)
      .sort()
      .pop();
    const range = rangeOf(state, f, last);
    const units = new Set(series.map((s) => displayUnit(s.kind, byId[s.id].unit)));
    const asIndex = units.size > 1;
    const prepared = {};
    for (const s of series) {
      const c = byId[s.id];
      prepared[s.id] = prepare(points[s.id], { f, agg: c.agg, unit: c.unit, native: c.freq, kind: asIndex ? 'index' : s.kind, lag: s.lag, ...range });
    }
    return {
      f,
      asIndex,
      unit: asIndex ? '지수 (시작=100)' : [...units][0],
      rows: align(prepared),
      lines: series.map((s) => ({ id: s.id, name: byId[s.id].name, color: s.color })),
    };
  }, [catalog, points, state]);

  const chartName = CHARTS.find(([k]) => k === state.chart)?.[1] ?? '시계열';

  return (
    <div className="rounded-xl border border-primary/20 bg-primary-light p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <span className="material-symbols-outlined text-lg text-primary">construction</span>
          붙인 분석 · {chartName}
        </p>
        <Link
          to={`/analysis?${query}`}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
        >
          작업대에서 열기
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
      {!view ? (
        <p className="py-8 text-center text-xs text-subtext-light">미리보기를 불러오는 중이에요</p>
      ) : view.lines.length === 0 ? (
        <p className="py-8 text-center text-xs text-subtext-light">붙인 분석의 지표를 지금 목록에서 찾지 못했어요.</p>
      ) : (
        <div className="mt-2 rounded-lg bg-white p-3">
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtext-light">
            <span className="font-semibold text-text-main">{view.unit}</span>
            {view.lines.map((l) => (
              <span key={l.id} className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: colorOf(l.color) }} />
                {l.name}
              </span>
            ))}
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={view.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="key" tickFormatter={(k) => keyLabel(k, view.f)} tick={AXIS.tick} minTickGap={36} />
                <YAxis tick={AXIS.tick} width={44} domain={['auto', 'auto']} />
                <Tooltip content={<PreviewTip lines={view.lines} f={view.f} />} />
                {view.lines.map((l) => (
                  <Line key={l.id} dataKey={(r) => r[l.id]} stroke={colorOf(l.color)} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {(view.asIndex || state.chart !== 'line' || state.conditions.length > 0) && (
            <p className="mt-1 text-[11px] text-subtext-light">
              미리보기는 시계열{view.asIndex ? '(단위가 달라 지수로 겹쳐)' : ''}로 보여 줘요. 작업대에서 열면 {chartName}
              {state.conditions.length > 0 ? ' · 조건' : ''}까지 그대로 보여요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
