import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api/api';
import { align, bucketOf, periodStart, prepare } from '../../lib/series';
import { TEMPLATES } from '../workbench/templates';
import { AXIS, colorOf, keyLabel, num } from '../workbench/format';

const TEMPLATE = TEMPLATES.find((t) => t.key === 'transmission');

function PreviewTip({ active, payload, names }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow px-3 py-2 text-xs">
      <p className="font-semibold text-text-main mb-1">{keyLabel(row.key, 'w')} 주</p>
      {names.map(
        (n) =>
          row[n.id] != null && (
            <p key={n.id} className="text-text-main">
              <span style={{ color: colorOf(n.color) }}>●</span> {n.name} <b>{num(row[n.id])}</b>
            </p>
          ),
      )}
    </div>
  );
}

// 홈 첫 화면의 작업대 미리보기 — 첫 품목의 '도매가 → 소매가' 템플릿을 최근 1년, 주 단위 지수로.
// 품목은 지표 목록에서 고른다(코드에 품목 이름 없음)
export default function WorkbenchPreview({ catalog }) {
  const item = useMemo(() => TEMPLATE.items(catalog)[0] ?? null, [catalog]);
  const series = useMemo(() => (item ? TEMPLATE.build(catalog, item).series : []), [catalog, item]);
  const entries = useMemo(() => series.map((s) => catalog.find((c) => c.id === s.id)).filter(Boolean), [series, catalog]);
  const [points, setPoints] = useState(null);

  const from = useMemo(() => {
    const last = entries.map((c) => c.lastDate).filter(Boolean).sort().pop();
    return periodStart('1y', last);
  }, [entries]);

  useEffect(() => {
    if (!entries.length) return undefined;
    let alive = true;
    api
      .getSeriesData(
        entries.map((c) => c.id),
        from,
      )
      .then((res) => alive && setPoints(Object.fromEntries((res.series ?? []).map((s) => [s.id, s.points]))))
      .catch(() => alive && setPoints({}));
    return () => {
      alive = false;
    };
  }, [entries, from]);

  const rows = useMemo(() => {
    if (!points) return [];
    const start = from ? bucketOf(from, 'w') : null;
    const prepared = {};
    for (const c of entries) {
      if (points[c.id]?.length) {
        prepared[c.id] = prepare(points[c.id], { f: 'w', agg: c.agg, unit: c.unit, native: c.freq, kind: 'index', from: start });
      }
    }
    return align(prepared);
  }, [points, entries, from]);

  if (!item) return null;
  const names = series.map((s) => ({ ...s, name: catalog.find((c) => c.id === s.id)?.name ?? s.id }));
  const link = `/analysis?tpl=transmission&item=${encodeURIComponent(item)}`;

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-primary">작업대 미리보기</p>
        <span className="text-[11px] text-subtext-light">최근 1년 · 주 단위 · 지수(시작=100)</span>
      </div>
      <p className="mt-1 font-bold text-text-main">{item} 도매가 → 소매가</p>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-subtext-light">
        {names.map((n) => (
          <span key={n.id} className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: colorOf(n.color) }} />
            {n.name}
          </span>
        ))}
      </div>
      <div className="mt-2 h-44">
        {rows.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs text-subtext-light">{points ? '아직 그릴 값이 없어요' : '불러오는 중이에요'}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="key" tickFormatter={(k) => keyLabel(k, 'm')} tick={AXIS.tick} minTickGap={36} />
              <YAxis tick={AXIS.tick} width={36} domain={['auto', 'auto']} />
              <ReferenceLine y={100} stroke={AXIS.base} strokeDasharray="4 4" />
              <Tooltip content={<PreviewTip names={names} />} />
              {names.map((n) => (
                <Line key={n.id} dataKey={(r) => r[n.id]} stroke={colorOf(n.color)} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <Link to={link} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        작업대에서 열어 시차·조건까지 보기
        <span className="material-symbols-outlined text-base">arrow_forward</span>
      </Link>
    </div>
  );
}
